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
});
