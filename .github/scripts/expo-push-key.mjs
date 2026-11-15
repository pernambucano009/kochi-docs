// مرة واحدة: بيرفع مفتاح APNs على Expo ويربطه بـ com.geekzone.simsimkit (عشان إشعارات iOS تشتغل عن طريق Expo Push).
// المفتاح من secret (APNS_KEY_P8) وما بيتطبعش. لو المفتاح مربوط قبل كده، مابيعملش حاجة.
const TOKEN = process.env.EXPO_TOKEN, P8 = process.env.APNS_KEY_P8;
const KEY_ID = process.env.APNS_KEY_ID, TEAM = process.env.APPLE_TEAM_ID;
const FULL = "@geekzone-sa/simsimkit", BUNDLE = "com.geekzone.simsimkit";
if (!TOKEN || !P8 || !KEY_ID || !TEAM) { console.error("missing env"); process.exit(1); }

async function gql(query, variables = {}) {
  const r = await fetch("https://api.expo.dev/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) { console.error("GraphQL error:", JSON.stringify(j.errors).slice(0, 1500)); process.exit(1); }
  return j.data;
}

const app = (await gql(`query($f:String!){ app { byFullName(fullName:$f){ id ownerAccount{ id name } } } }`, { f: FULL })).app.byFullName;
const accountId = app.ownerAccount.id, accountName = app.ownerAccount.name;
console.log("app", app.id, "account", accountName);

let team = (await gql(`query($a:ID!,$t:String!){ appleTeam { byAppleTeamIdentifier(accountId:$a, identifier:$t){ id } } }`, { a: accountId, t: TEAM })).appleTeam.byAppleTeamIdentifier;
if (!team) team = (await gql(`mutation($i:AppleTeamInput!,$a:ID!){ appleTeam { createAppleTeam(appleTeamInput:$i, accountId:$a){ id } } }`,
  { i: { appleTeamIdentifier: TEAM, appleTeamType: "INDIVIDUAL" }, a: accountId })).appleTeam.createAppleTeam;
console.log("appleTeam", team.id);

let ids = (await gql(`query($n:String!,$b:String!){ account { byName(accountName:$n){ appleAppIdentifiers(bundleIdentifier:$b){ id } } } }`, { n: accountName, b: BUNDLE })).account.byName.appleAppIdentifiers;
let appId = ids[0];
if (!appId) appId = (await gql(`mutation($i:AppleAppIdentifierInput!,$a:ID!){ appleAppIdentifier { createAppleAppIdentifier(appleAppIdentifierInput:$i, accountId:$a){ id } } }`,
  { i: { bundleIdentifier: BUNDLE, appleTeamId: team.id }, a: accountId })).appleAppIdentifier.createAppleAppIdentifier;
console.log("appleAppIdentifier", appId.id);

const creds = (await gql(`query($f:String!,$aid:String!){ app { byFullName(fullName:$f){ iosAppCredentials(filter:{ appleAppIdentifierId:$aid }){ id pushKey{ id keyIdentifier } } } } }`,
  { f: FULL, aid: appId.id })).app.byFullName.iosAppCredentials;
if (creds[0]?.pushKey?.keyIdentifier === KEY_ID) { console.log("✅ push key already linked:", KEY_ID); process.exit(0); }

const key = (await gql(`mutation($i:ApplePushKeyInput!,$a:ID!){ applePushKey { createApplePushKey(applePushKeyInput:$i, accountId:$a){ id keyIdentifier } } }`,
  { i: { keyP8: P8, keyIdentifier: KEY_ID, appleTeamId: team.id }, a: accountId })).applePushKey.createApplePushKey;
console.log("applePushKey", key.id, key.keyIdentifier);

if (creds[0]) {
  await gql(`mutation($id:ID!,$k:ID!){ iosAppCredentials { setPushKey(id:$id, pushKeyId:$k){ id } } }`, { id: creds[0].id, k: key.id });
  console.log("✅ linked to existing iosAppCredentials", creds[0].id);
} else {
  const c = (await gql(`mutation($i:IosAppCredentialsInput!,$app:ID!,$aid:ID!){ iosAppCredentials { createIosAppCredentials(iosAppCredentialsInput:$i, appId:$app, appleAppIdentifierId:$aid){ id } } }`,
    { i: { appleTeamId: team.id, pushKeyId: key.id }, app: app.id, aid: appId.id })).iosAppCredentials.createIosAppCredentials;
  console.log("✅ created iosAppCredentials with push key", c.id);
}
