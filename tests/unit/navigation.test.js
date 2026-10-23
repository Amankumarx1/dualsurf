import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NavigationService } from '../../packages/controller/dist/NavigationService.js';

describe('NavigationService URL Normalization', () => {
  const service = new NavigationService('duckduckgo');

  it('normalizes full HTTPS URLs', () => {
    assert.equal(
      service.normalizeUrl('https://example.com/test'),
      'https://example.com/test'
    );
  });

  it('normalizes localhost and ports without scheme', () => {
    assert.equal(
      service.normalizeUrl('localhost:3000'),
      'http://localhost:3000'
    );
    assert.equal(
      service.normalizeUrl('127.0.0.1:8080/dashboard'),
      'http://127.0.0.1:8080/dashboard'
    );
  });

  it('prepends https to domain names', () => {
    assert.equal(
      service.normalizeUrl('github.com'),
      'https://github.com'
    );
    assert.equal(
      service.normalizeUrl('kernel.org/doc/html/latest/'),
      'https://kernel.org/doc/html/latest/'
    );
  });

  it('preserves special schemes', () => {
    assert.equal(
      service.normalizeUrl('dualsurf://settings'),
      'dualsurf://settings'
    );
    assert.equal(
      service.normalizeUrl('about:blank'),
      'about:blank'
    );
  });

  it('converts multi-word queries into search engine URLs', () => {
    assert.equal(
      service.normalizeUrl('linux kernel build guide'),
      'https://duckduckgo.com/?q=linux%20kernel%20build%20guide'
    );
  });

  it('supports switching default search engine', () => {
    const googleService = new NavigationService('google');
    assert.equal(
      googleService.normalizeUrl('electron webcontentsview'),
      'https://www.google.com/search?q=electron%20webcontentsview'
    );

    const braveService = new NavigationService('brave');
    assert.equal(
      braveService.normalizeUrl('arch linux tui'),
      'https://search.brave.com/search?q=arch%20linux%20tui'
    );
  });

  it('handles offline file schemes and local paths', () => {
    assert.equal(
      service.normalizeUrl('file:///var/www/html/index.html'),
      'file:///var/www/html/index.html'
    );
    const local = service.normalizeUrl('./test.html');
    assert.ok(local.startsWith('file://'));
    assert.ok(local.includes('test.html'));
  });

  it('normalizes private intranet and local lab subnets directly without search engine', () => {
    assert.equal(
      service.normalizeUrl('192.168.1.1:8080/admin'),
      'http://192.168.1.1:8080/admin'
    );
    assert.equal(
      service.normalizeUrl('10.0.0.5:9000/api'),
      'http://10.0.0.5:9000/api'
    );
    assert.equal(
      service.normalizeUrl('0.0.0.0:5000'),
      'http://0.0.0.0:5000'
    );
  });

  it('supports DuckDuckGo-style bang shortcuts', () => {
    assert.equal(
      service.normalizeUrl('!gh dualsurf'),
      'https://github.com/search?q=dualsurf'
    );
    assert.equal(
      service.normalizeUrl('!w linux kernel'),
      'https://en.wikipedia.org/wiki/Special:Search?search=linux%20kernel'
    );
    assert.equal(
      service.normalizeUrl('!yt defcon presentations'),
      'https://www.youtube.com/results?search_query=defcon%20presentations'
    );
    assert.equal(
      service.normalizeUrl('!cve log4j'),
      'https://cve.mitre.org/cgi-bin/cvekey.cgi?keyword=log4j'
    );
    assert.equal(
      service.normalizeUrl('!shodan apache'),
      'https://www.shodan.io/search?query=apache'
    );
  });
});
