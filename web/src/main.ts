import { mount } from 'svelte';
import App from './App.svelte';
import { isEnvBrowser } from './lib/nui';
import './app.css';

// No icon library registration. Server configs pass arbitrary FontAwesome class strings,
// which is why all three packs had to be loaded up front — 27 MB in node_modules to serve
// the handful of icons anything actually asks for. lib/icons.ts is an explicit map of those
// instead, so each icon is a static import and the bundler keeps only what is referenced.
//
// The class string is still the API. What went away is the icon font behind it, and before
// that the CDN stylesheet the stock index.html loaded, which failed outright in CEF with no
// internet and rendered every icon as an empty box.

if (isEnvBrowser()) {
  document.documentElement.classList.add('nui-browser');
}

const app = mount(App, { target: document.getElementById('root')! });

export default app;
