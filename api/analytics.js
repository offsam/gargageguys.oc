module.exports = async function handler(req, res) {
  const measurementId = process.env.GA4_MEASUREMENT_ID?.trim();
  if (!measurementId) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send('/* GA4_MEASUREMENT_ID is not configured */');
  }

  const js = `(function(){
  window.dataLayer=window.dataLayer||[];
  function gtag(){dataLayer.push(arguments);}
  window.gtag=gtag;
  gtag('js', new Date());
  gtag('config', '${measurementId}', { anonymize_ip: true });
  var s=document.createElement('script');
  s.async=true;
  s.src='https://www.googletagmanager.com/gtag/js?id=${measurementId}';
  document.head.appendChild(s);
})();`;

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).send(js);
};
