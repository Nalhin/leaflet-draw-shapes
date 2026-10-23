import { afterEach } from 'vitest';

// Leaflet scrolls on focus, which jsdom does not implement.
window.scrollTo = () => undefined;

// jsdom does no layout, so give every element a size for Leaflet to work with.
Object.defineProperties(HTMLElement.prototype, {
  clientWidth: { configurable: true, get: () => 800 },
  clientHeight: { configurable: true, get: () => 600 },
});

afterEach(() => {
  document.body.innerHTML = '';
});
