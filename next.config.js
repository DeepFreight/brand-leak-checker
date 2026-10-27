const fa = process.env.FRAME_ANCESTORS || "'self' https://weareoffcut.com https://*.weareoffcut.com";
module.exports = { async headers() { return [{ source: '/:path*', headers: [
  { key: 'Content-Security-Policy', value: `frame-ancestors ${fa}` },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' } ] }]; } };
