# Authentication

## Scheme

```text
Microsoft OAuth2 -> Xbox Live (XBL) -> XSTS -> Minecraft Services -> Profile
access token        user token         token   access token          UUID,
refresh token                                  (24h JWT)             name,
                                                                     skins
```

The implementation is located in [`src/lib/auth/`](../src/lib/auth/): `index.ts` exports the entry points, and each step of the scheme above has its own file in `scopes/`; `scopes/complete-authentication-chain.ts` runs the steps that follow the Microsoft tokens.
