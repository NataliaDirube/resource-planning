export const msalConfig = {
  auth: {
    clientId: "24283d96-b5f1-4161-9163-39d685602303",
    authority: "https://login.microsoftonline.com/a23aa37c-3cbc-4c48-b731-1dd54489367a",
    redirectUri: window.location.origin,
  },
};

export const loginRequest = {
  scopes: ["Sites.Read.All", "Sites.Manage.All", "User.Read"],
};

export const sharePointConfig = {
  siteUrl: "https://goexpcomp.sharepoint.com/sites/DATACENTER",
};
