import { NextResponse } from "next/server";

// Serves widget.js with the actual NEXT_PUBLIC_APP_URL baked in at runtime.
// Customers embed: <script src="https://your-app.vercel.app/api/widget-script"
//                          data-business-id="xxx"></script>
export function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const script = `(function(){
  var script=document.currentScript;
  var businessId=script.getAttribute("data-business-id");
  if(!businessId){console.error("[SupportAI] Missing data-business-id.");return;}
  var iframe=document.createElement("iframe");
  iframe.src="${appUrl}/widget/"+businessId;
  iframe.allow="microphone";
  iframe.style.cssText="position:fixed;bottom:20px;right:20px;width:380px;height:600px;border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.15);z-index:9999;transition:opacity 0.2s ease,transform 0.2s ease;";
  document.body.appendChild(iframe);
})();`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
