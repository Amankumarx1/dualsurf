import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MetadataDatabase } from '../../packages/storage/dist/database.js';
import { NavigationService } from '../../packages/controller/dist/NavigationService.js';
import { PageInspector } from '../../packages/controller/dist/PageInspector.js';

describe('Deep Toughest Audit & Asymmetry Verification Suite', () => {
  // ----------------------------------------------------------------------
  // 1. MetadataDatabase & Bookmark Deduplication
  // ----------------------------------------------------------------------
  describe('MetadataDatabase Storage Invariants & Deduplication', () => {
    it('deduplicates bookmarks with identical URLs for the same profile', () => {
      const db = new MetadataDatabase({ inMemory: true });

      const bm1 = db.addBookmark('https://example.com/tool', 'Tool Initial Title');
      assert.ok(bm1.id.startsWith('bm-'));
      assert.equal(bm1.title, 'Tool Initial Title');

      // Add identical URL with new title
      const bm2 = db.addBookmark('https://example.com/tool', 'Tool Updated Title');
      assert.equal(bm2.id, bm1.id, 'Expected same bookmark ID to be returned');
      assert.equal(bm2.title, 'Tool Updated Title', 'Expected title to be updated');

      const all = db.getBookmarks();
      assert.equal(all.length, 1, 'Expected exactly 1 bookmark in list, not duplicated');
      assert.equal(all[0].id, bm1.id);
      assert.equal(all[0].title, 'Tool Updated Title');

      // Add a distinct URL
      const bm3 = db.addBookmark('https://github.com/dualsurf', 'DualSurf Repo');
      const allAfter = db.getBookmarks();
      assert.equal(allAfter.length, 2);

      // Remove first bookmark
      const removed = db.removeBookmark(bm1.id);
      assert.equal(removed, true);
      assert.equal(db.getBookmarks().length, 1);
      assert.equal(db.getBookmarks()[0].id, bm3.id);
    });

    it('records history and clears with time-range boundaries accurately', () => {
      const db = new MetadataDatabase({ inMemory: true });

      db.addHistory('https://site1.org', 'Site 1');
      db.addHistory('https://site2.org', 'Site 2');
      assert.equal(db.getHistory().length, 2);

      // Search history
      const found = db.searchHistory('site1');
      assert.equal(found.length, 1);
      assert.equal(found[0].url, 'https://site1.org');

      // Clear all
      db.clearHistory();
      assert.equal(db.getHistory().length, 0);
    });
  });

  // ----------------------------------------------------------------------
  // 2. NavigationService URL Normalization & Bang Short-circuiting
  // ----------------------------------------------------------------------
  describe('NavigationService Exhaustive Edge Cases', () => {
    const nav = new NavigationService('duckduckgo');

    it('defends against executable schemes by converting them to search', () => {
      assert.ok(nav.normalizeUrl('javascript:alert(document.cookie)').includes('duckduckgo.com/?q=javascript'));
      assert.ok(nav.normalizeUrl('vbscript:msgbox("hello")').includes('duckduckgo.com/?q=vbscript'));
    });

    it('handles bang shortcuts with and without arguments', () => {
      // With argument
      assert.equal(nav.normalizeUrl('!gh dualsurf'), 'https://github.com/search?q=dualsurf');
      assert.equal(nav.normalizeUrl('!w cybersecurity'), 'https://en.wikipedia.org/wiki/Special:Search?search=cybersecurity');
      assert.equal(nav.normalizeUrl('!cve 2024-1234'), 'https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=2024-1234');
      assert.equal(nav.normalizeUrl('!shodan apache'), 'https://www.shodan.io/search?query=apache');
      assert.equal(nav.normalizeUrl('!so rust lifetime'), 'https://stackoverflow.com/search?q=rust%20lifetime');

      // Without argument (short-circuits directly to homepage)
      assert.equal(nav.normalizeUrl('!gh'), 'https://github.com');
      assert.equal(nav.normalizeUrl('!w'), 'https://en.wikipedia.org');
      assert.equal(nav.normalizeUrl('!yt'), 'https://www.youtube.com');
      assert.equal(nav.normalizeUrl('!g'), 'https://www.google.com');
      assert.equal(nav.normalizeUrl('!d'), 'https://duckduckgo.com');
    });

    it('routes local dev subnets and private IPs to http scheme', () => {
      assert.equal(nav.normalizeUrl('localhost:3000'), 'http://localhost:3000');
      assert.equal(nav.normalizeUrl('127.0.0.1:8080/dashboard'), 'http://127.0.0.1:8080/dashboard');
      assert.equal(nav.normalizeUrl('192.168.1.1:8443'), 'http://192.168.1.1:8443');
      assert.equal(nav.normalizeUrl('10.0.0.50/api'), 'http://10.0.0.50/api');
      assert.equal(nav.normalizeUrl('172.16.0.1:9090'), 'http://172.16.0.1:9090');
    });

    it('recognizes standard domain names and preserves https scheme', () => {
      assert.equal(nav.normalizeUrl('example.com'), 'https://example.com');
      assert.equal(nav.normalizeUrl('api.subdomain.target.org/v1/health'), 'https://api.subdomain.target.org/v1/health');
      assert.equal(nav.normalizeUrl('https://existing.secure.com'), 'https://existing.secure.com');
    });

    it('falls back to search query for multi-word or plain terms', () => {
      assert.equal(nav.normalizeUrl('how to install arch linux'), 'https://duckduckgo.com/?q=how%20to%20install%20arch%20linux');
    });
  });

  // ----------------------------------------------------------------------
  // 3. PageInspector Security Findings & CVE Classification
  // ----------------------------------------------------------------------
  describe('PageInspector IOC & CVE Threat Classification', () => {
    const inspector = new PageInspector();

    it('extracts CVE numbers and tags them strictly with type "cve"', async () => {
      const mockWc = {
        isDestroyed: () => false,
        getTitle: () => 'Security Bulletin',
        getURL: () => 'https://advisory.security.org/CVE-2024-3094',
        isLoading: () => false,
        executeJavaScript: async () => ({
          headings: [{ level: 1, text: 'Critical XZ Backdoor Advisory' }],
          links: [
            { id: 1, label: 'NVD CVE-2024-3094 Reference', href: 'https://nvd.nist.gov/vuln/detail/CVE-2024-3094' }
          ],
          endpoints: [],
          cookies: [],
          storage: [],
          forms: [],
          scripts: [],
          textSnippet: 'Detailed analysis of CVE-2024-3094 and prior CVE-2023-44487 HTTP/2 Rapid Reset.',
        }),
      };

      const meta = await inspector.inspectPage(mockWc);
      assert.equal(meta.title, 'Security Bulletin');
      assert.ok(meta.iocs && meta.iocs.length >= 2);

      const cveFinding = meta.iocs.find((ioc) => ioc.value === 'CVE-2024-3094');
      assert.ok(cveFinding, 'Expected CVE-2024-3094 in findings');
      assert.equal(cveFinding.type, 'cve', 'Expected type to be "cve" instead of "domain"');
      assert.equal(cveFinding.reputation, 'SUSPICIOUS');
      assert.ok(cveFinding.mitreTags.includes('T1190 - Exploit Public-Facing Application'));
    });

    it('correctly classifies private RFC1918 IPs vs public IPs with MITRE tags', async () => {
      const mockWc = {
        isDestroyed: () => false,
        getTitle: () => 'Network Topology',
        getURL: () => 'https://net.local',
        isLoading: () => false,
        executeJavaScript: async () => ({
          headings: [],
          links: [],
          endpoints: [],
          cookies: [],
          storage: [],
          forms: [],
          scripts: [],
          textSnippet: 'Connecting from gateway 192.168.1.1 to upstream DNS 8.8.8.8 and local testbed 10.0.0.5',
        }),
      };

      const meta = await inspector.inspectPage(mockWc);
      const privIp = meta.iocs?.find((i) => i.value === '192.168.1.1');
      assert.ok(privIp);
      assert.equal(privIp.isPrivate, true);
      assert.equal(privIp.reputation, 'BENIGN');

      const pubIp = meta.iocs?.find((i) => i.value === '8.8.8.8');
      assert.ok(pubIp);
      assert.equal(pubIp.isPrivate, false);
      assert.equal(pubIp.reputation, 'UNKNOWN');
    });

    it('handles destroyed or null webContents safely without exception', async () => {
      const destroyedWc = {
        isDestroyed: () => true,
      };

      const res1 = await inspector.inspectPage(destroyedWc);
      assert.equal(res1.title, '');
      assert.equal(res1.headings.length, 0);

      const res2 = await inspector.clickNumberedLink(destroyedWc, 1);
      assert.equal(res2, null);

      const res3 = await inspector.findInPage(destroyedWc, 'query');
      assert.equal(res3.count, 0);
    });
  });

  // ----------------------------------------------------------------------
  // 4. Tab State Order & Pinned Tab Batch-Close Invariants
  // ----------------------------------------------------------------------
  describe('Tab State Ordering & Pinned Tab Protection Simulation', () => {
    class TabManagerSimulator {
      constructor() {
        this.tabs = new Map();
        this.activeTabId = null;
        this.history = [];
      }

      addTab(id, url, pinned = false) {
        this.tabs.set(id, { id, url, pinned, title: id });
        if (!this.activeTabId) this.activeTabId = id;
      }

      getAllTabs() {
        const list = Array.from(this.tabs.values()).map(t => ({ ...t }));
        return list.sort((a, b) => {
          if (a.pinned === b.pinned) return 0;
          return a.pinned ? -1 : 1;
        });
      }

      closeTab(id) {
        const target = this.tabs.get(id);
        if (!target) return false;

        this.history.push({ ...target });
        const visual = this.getAllTabs();
        const closedIdx = visual.findIndex(t => t.id === id);

        let nextActive = null;
        if (this.activeTabId === id && visual.length > 1) {
          if (closedIdx + 1 < visual.length) {
            nextActive = visual[closedIdx + 1].id;
          } else if (closedIdx > 0) {
            nextActive = visual[closedIdx - 1].id;
          }
        }

        this.tabs.delete(id);

        if (this.activeTabId === id) {
          if (nextActive && this.tabs.has(nextActive)) {
            this.activeTabId = nextActive;
          } else if (this.tabs.size > 0) {
            this.activeTabId = this.getAllTabs()[0].id;
          } else {
            this.activeTabId = 'new-tab-default';
            this.tabs.set('new-tab-default', { id: 'new-tab-default', url: 'https://duckduckgo.com', pinned: false, title: 'New Tab' });
          }
        }

        return true;
      }

      closeOtherTabs(tabId) {
        const visual = this.getAllTabs();
        for (const t of visual) {
          if (t.id !== tabId && !t.pinned) {
            this.closeTab(t.id);
          }
        }
        this.activeTabId = tabId;
        return true;
      }

      closeTabsToTheRight(tabId) {
        const visual = this.getAllTabs();
        const idx = visual.findIndex(t => t.id === tabId);
        if (idx < 0) return false;
        for (let i = idx + 1; i < visual.length; i++) {
          const t = visual[i];
          if (!t.pinned) {
            this.closeTab(t.id);
          }
        }
        return true;
      }
    }

    it('ensures pinned tabs always sort before unpinned tabs regardless of insertion order', () => {
      const sim = new TabManagerSimulator();
      sim.addTab('tab-1', 'https://site1.org', false);
      sim.addTab('tab-2', 'https://site2.org', false);
      sim.addTab('tab-3', 'https://site3.org', true);

      const visual = sim.getAllTabs();
      assert.equal(visual[0].id, 'tab-3', 'Pinned tab must be at the very front');
      assert.equal(visual[0].pinned, true);
      assert.equal(visual[1].id, 'tab-1');
      assert.equal(visual[2].id, 'tab-2');
    });

    it('protects pinned tabs from being closed by closeOtherTabs', () => {
      const sim = new TabManagerSimulator();
      sim.addTab('pinned-1', 'https://pin.org', true);
      sim.addTab('tab-A', 'https://a.org', false);
      sim.addTab('tab-B', 'https://b.org', false);
      sim.activeTabId = 'tab-B';

      sim.closeOtherTabs('tab-B');

      const remaining = sim.getAllTabs();
      assert.equal(remaining.length, 2, 'Expected pinned tab and tab-B to survive');
      assert.ok(remaining.some(t => t.id === 'pinned-1'));
      assert.ok(remaining.some(t => t.id === 'tab-B'));
      assert.equal(sim.activeTabId, 'tab-B');
    });

    it('protects pinned tabs and visual ordering in closeTabsToTheRight', () => {
      const sim = new TabManagerSimulator();
      sim.addTab('tab-1', 'https://1.org', false);
      sim.addTab('tab-2', 'https://2.org', false);
      sim.addTab('pinned-1', 'https://pin.org', true);
      sim.addTab('tab-3', 'https://3.org', false);

      // Visual order: [pinned-1, tab-1, tab-2, tab-3]
      const visualBefore = sim.getAllTabs();
      assert.equal(visualBefore[0].id, 'pinned-1');
      assert.equal(visualBefore[1].id, 'tab-1');
      assert.equal(visualBefore[2].id, 'tab-2');
      assert.equal(visualBefore[3].id, 'tab-3');

      sim.closeTabsToTheRight('tab-1');

      const visualAfter = sim.getAllTabs();
      assert.equal(visualAfter.length, 2);
      assert.equal(visualAfter[0].id, 'pinned-1');
      assert.equal(visualAfter[1].id, 'tab-1');
    });

    it('smoothly activates adjacent tab when closing middle tab', () => {
      const sim = new TabManagerSimulator();
      sim.addTab('tab-1', 'https://1.org', false);
      sim.addTab('tab-2', 'https://2.org', false);
      sim.addTab('tab-3', 'https://3.org', false);
      sim.activeTabId = 'tab-2';

      sim.closeTab('tab-2');
      assert.equal(sim.activeTabId, 'tab-3');

      sim.closeTab('tab-3');
      assert.equal(sim.activeTabId, 'tab-1');

      sim.closeTab('tab-1');
      assert.equal(sim.activeTabId, 'new-tab-default');
      assert.equal(sim.getAllTabs().length, 1);
    });
  });
});
