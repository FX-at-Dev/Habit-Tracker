exports.handler = async () => {
  const config = {
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    appId: process.env.FIREBASE_APP_ID || "",
  };

  const ok = Boolean(config.apiKey && config.projectId && config.appId);

  return {
    statusCode: ok ? 200 : 500,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(
      ok
        ? config
        : {
            error:
              "Missing FIREBASE_* env vars. Set them in Netlify: Site settings → Environment variables.",
          }
    ),
  };
};
