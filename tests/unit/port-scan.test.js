import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as net from 'net';
import {
  PORT_PROFILES,
  PORT_DATABASE,
  probeTcpPort,
  scanPorts,
  formatPortScanReport,
} from '../../apps/cli/dist/tools/portScan.js';
import {
  generateFullAuditReport,
  generateHtmlAuditReport,
  formatAutoAuditTerminal,
} from '../../apps/cli/dist/tools/autoAudit.js';

describe('Perimeter Port Scanning & Automated Service Discovery', () => {
  describe('Port Profiles & Database Metadata', () => {
    it('defines standard scanning profiles (web, common, top20, db, all)', () => {
      assert.ok(Array.isArray(PORT_PROFILES.web), 'web profile should be an array');
      assert.ok(PORT_PROFILES.web.includes(80));
      assert.ok(PORT_PROFILES.web.includes(443));

      assert.ok(Array.isArray(PORT_PROFILES.db), 'db profile should be an array');
      assert.ok(PORT_PROFILES.db.includes(3306)); // MySQL
      assert.ok(PORT_PROFILES.db.includes(5432)); // PostgreSQL
      assert.ok(PORT_PROFILES.db.includes(6379)); // Redis
      assert.ok(PORT_PROFILES.db.includes(27017)); // MongoDB

      assert.ok(Array.isArray(PORT_PROFILES.common), 'common profile should be an array');
      assert.ok(PORT_PROFILES.common.includes(22)); // SSH
      assert.ok(PORT_PROFILES.common.includes(21)); // FTP
      assert.ok(PORT_PROFILES.common.includes(3389)); // RDP

      assert.ok(PORT_PROFILES.all.length >= 35, 'all profile should cover 35+ perimeter ports');
    });

    it('contains comprehensive service metadata and hardening guidance for critical ports', () => {
      const telnet = PORT_DATABASE[23];
      assert.ok(telnet);
      assert.equal(telnet.service, 'Telnet');
      assert.equal(telnet.defaultRisk, 'CRITICAL');
      assert.ok(telnet.mitreTechnique.includes('T1021'));
      assert.ok(telnet.hardeningAdvice.toLowerCase().includes('ssh'));

      const redis = PORT_DATABASE[6379];
      assert.ok(redis);
      assert.equal(redis.service, 'Redis');
      assert.equal(redis.defaultRisk, 'CRITICAL');
      assert.ok(redis.hardeningAdvice.toLowerCase().includes('bind 127.0.0.1'));

      const rdp = PORT_DATABASE[3389];
      assert.ok(rdp);
      assert.equal(rdp.service, 'RDP');
      assert.equal(rdp.defaultRisk, 'HIGH');
      assert.ok(rdp.mitreTechnique.includes('T1021.001'));
    });
  });

  describe('TCP Socket Probing & Banner Grabbing', () => {
    function withTestServer(handler, testFn) {
      return new Promise((resolveTest, rejectTest) => {
        const sockets = new Set();
        const server = net.createServer((sock) => {
          sockets.add(sock);
          sock.on('close', () => sockets.delete(sock));
          handler(sock);
        });

        server.listen(0, '127.0.0.1', async () => {
          const port = server.address().port;
          try {
            await testFn(port);
            resolveTest();
          } catch (err) {
            rejectTest(err);
          } finally {
            for (const sock of sockets) {
              try { sock.destroy(); } catch {}
            }
            server.close();
          }
        });
      });
    }

    it('returns null on a closed or unreachable port', async () => {
      const res = await probeTcpPort('127.0.0.1', 59991, 300);
      assert.equal(res, null);
    });

    it('accurately identifies an open TCP listener and grabs banner', async () => {
      await withTestServer(
        (socket) => {
          socket.write('SSH-2.0-OpenSSH_9.3p1 DualSurf-Test\r\n');
        },
        async (testPort) => {
          const portInfo = await probeTcpPort('127.0.0.1', testPort, 800);
          assert.ok(portInfo, 'Port should be detected as open');
          assert.equal(portInfo.port, testPort);
          assert.equal(portInfo.protocol, 'tcp');
          assert.equal(portInfo.state, 'open');
          assert.ok(portInfo.latencyMs >= 0);
          assert.ok(portInfo.banner?.includes('SSH-2.0-OpenSSH_9.3p1'));
        }
      );
    });

    it('extracts Server: header on HTTP banner probe', async () => {
      await withTestServer(
        (socket) => {
          socket.on('data', () => {
            socket.write('HTTP/1.1 200 OK\r\nServer: Caddy/2.7.4\r\nContent-Length: 0\r\n\r\n');
          });
        },
        async (testPort) => {
          const portInfo = await probeTcpPort('127.0.0.1', testPort, 800);
          assert.ok(portInfo);
          assert.equal(portInfo.state, 'open');
          assert.ok(portInfo.banner?.includes('Caddy/2.7.4') || portInfo.banner?.includes('HTTP/1.1'));
        }
      );
    });
  });

  describe('Automated scanPorts Engine', () => {
    function withTestServer(handler, testFn) {
      return new Promise((resolveTest, rejectTest) => {
        const sockets = new Set();
        const server = net.createServer((sock) => {
          sockets.add(sock);
          sock.on('close', () => sockets.delete(sock));
          handler(sock);
        });

        server.listen(0, '127.0.0.1', async () => {
          const port = server.address().port;
          try {
            await testFn(port);
            resolveTest();
          } catch (err) {
            rejectTest(err);
          } finally {
            for (const sock of sockets) {
              try { sock.destroy(); } catch {}
            }
            server.close();
          }
        });
      });
    }

    it('scans specified ports and compiles high-level report', async () => {
      await withTestServer(
        (socket) => {
          socket.write('220 DualSurf-FTP-Ready\r\n');
        },
        async (testPort) => {
          const report = await scanPorts('http://127.0.0.1:8080/test', {
            ports: [testPort, 59992],
            timeoutMs: 400,
            scopeCheck: false,
          });

          assert.equal(report.host, '127.0.0.1');
          assert.equal(report.scannedPortsCount, 2);
          assert.equal(report.openPortsCount, 1);
          assert.equal(report.openPorts[0].port, testPort);
          assert.ok(report.durationMs >= 0);
        }
      );
    });

    it('formats port scan report into clean terminal output', () => {
      const mockReport = {
        host: 'api.dualsurf.internal',
        ip: '192.168.1.100',
        scannedPortsCount: 12,
        openPortsCount: 2,
        durationMs: 45,
        openPorts: [
          {
            port: 80,
            protocol: 'tcp',
            state: 'open',
            service: 'HTTP',
            banner: 'Server: nginx/1.24.0',
            latencyMs: 15,
            risk: 'MEDIUM',
            riskReason: 'Unencrypted web traffic.',
            hardeningAdvice: 'Enforce automatic 301 redirect to HTTPS.',
          },
          {
            port: 6379,
            protocol: 'tcp',
            state: 'open',
            service: 'Redis',
            latencyMs: 12,
            risk: 'CRITICAL',
            riskReason: 'Exposed in-memory cache.',
            hardeningAdvice: 'Bind to 127.0.0.1 and set strong password.',
            mitreTechnique: 'T1190',
          },
        ],
        highRiskCount: 1,
        timestamp: '2026-10-14T05:00:00.000Z',
        inScope: true,
      };

      const output = formatPortScanReport(mockReport);
      assert.ok(output.includes('AUTOMATED PORT AUDIT & SERVICE PERIMETER SCANNER'));
      assert.ok(output.includes('api.dualsurf.internal'));
      assert.ok(output.includes('192.168.1.100'));
      assert.ok(output.includes('80/tcp'));
      assert.ok(output.includes('6379/tcp'));
      assert.ok(output.includes('CRITICAL PERIMETER HARDENING ADVISORIES'));
      assert.ok(output.includes('Bind to 127.0.0.1 and set strong password'));
    });
  });

  describe('Integration with Full Security Audit Reports', () => {
    const mockAuditWithPorts = {
      targetUrl: 'https://demo.dualsurf.security',
      normalizedUrl: 'https://demo.dualsurf.security/',
      host: 'demo.dualsurf.security',
      port: 443,
      protocol: 'https',
      timestamp: '2026-10-14T05:00:00.000Z',
      reachable: true,
      statusCode: 200,
      durationMs: 85,
      inScope: true,
      riskRating: 'CRITICAL',
      securityScore: 45,
      grade: 'D',
      techProfile: {
        servers: ['nginx/1.24.0'],
        frameworks: ['Express.js'],
        cms: [],
        cdnWaf: [],
      },
      headers: {
        score: 60,
        grade: 'C',
        serverBanner: 'nginx/1.24.0',
        items: [],
      },
      cors: {
        risk: 'CLEAN',
        verdict: 'Restricted origins',
      },
      secretsDetected: [],
      endpointsDetected: [],
      findings: [
        {
          id: 'FIND-2026-001',
          title: 'Critical Service Exposure: REDIS (Port 6379/tcp)',
          severity: 'CRITICAL',
          cvssScore: 9.0,
          affectedAsset: 'https://demo.dualsurf.security/',
          category: 'A05:2021 Security Misconfiguration',
          description: 'Exposed Redis database detected.',
          impact: 'Remote code execution or data dumping.',
          remediation: 'Bind to 127.0.0.1.',
          status: 'Open',
          createdAt: '2026-10-14T05:00:00.000Z',
        },
      ],
      portAudit: {
        host: 'demo.dualsurf.security',
        scannedPortsCount: 20,
        openPortsCount: 2,
        highRiskCount: 1,
        durationMs: 80,
        timestamp: '2026-10-14T05:00:00.000Z',
        openPorts: [
          {
            port: 443,
            protocol: 'tcp',
            state: 'open',
            service: 'HTTPS',
            risk: 'INFO',
            latencyMs: 18,
            banner: 'Server: nginx',
            hardeningAdvice: 'Harden TLS ciphers.',
          },
          {
            port: 6379,
            protocol: 'tcp',
            state: 'open',
            service: 'Redis',
            risk: 'CRITICAL',
            latencyMs: 22,
            hardeningAdvice: 'Bind to 127.0.0.1.',
          },
        ],
      },
    };

    it('renders exposed ports section in Markdown audit report', () => {
      const md = generateFullAuditReport(mockAuditWithPorts);
      assert.ok(md.includes('## 2.5. Exposed Perimeter Ports & Services'));
      assert.ok(md.includes('**6379**'));
      assert.ok(md.includes('Redis'));
      assert.ok(md.includes('CRITICAL'));
      assert.ok(md.includes('Bind to 127.0.0.1'));
    });

    it('renders exposed ports table in Interactive HTML audit report', () => {
      const html = generateHtmlAuditReport(mockAuditWithPorts);
      assert.ok(html.includes('Perimeter Ports &amp; Exposed Services') || html.includes('Perimeter Ports & Exposed Services'));
      assert.ok(html.includes('6379'));
      assert.ok(html.includes('badge-critical'));
      assert.ok(html.includes('Bind to 127.0.0.1'));
    });

    it('includes open ports metrics in terminal audit display', () => {
      const term = formatAutoAuditTerminal(mockAuditWithPorts);
      assert.ok(term.includes('Open Ports:'));
      assert.ok(term.includes('2 open'));
      assert.ok(term.includes('Port 6379/tcp:'));
      assert.ok(term.includes('Redis'));
    });
  });
});
