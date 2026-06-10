(function () {
  var script = document.currentScript;
  var businessId = script.getAttribute("data-business-id");
  if (!businessId) {
    console.error("[SupportAI] Missing data-business-id attribute on widget script tag.");
    return;
  }

  var APP_URL = "NEXT_PUBLIC_APP_URL_PLACEHOLDER";

  var iframe = document.createElement("iframe");
  iframe.src = APP_URL + "/widget/" + businessId;
  iframe.allow = "microphone";
  iframe.style.cssText =
    "position:fixed;" +
    "bottom:20px;" +
    "right:20px;" +
    "width:380px;" +
    "height:600px;" +
    "border:none;" +
    "border-radius:16px;" +
    "box-shadow:0 8px 32px rgba(0,0,0,0.15);" +
    "z-index:9999;" +
    "transition:opacity 0.2s ease,transform 0.2s ease;";

  document.body.appendChild(iframe);
})();
