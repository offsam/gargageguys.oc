import { NextResponse } from "next/server";

export async function GET() {
  const measurementId = process.env.GA4_MEASUREMENT_ID?.trim();
  if (!measurementId) {
    return new NextResponse("/* GA4_MEASUREMENT_ID is not configured */", {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
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

  return new NextResponse(js, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
