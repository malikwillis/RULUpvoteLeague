# RUL redesign

RUL website with Google sign-in, commissioner approvals, shareable team pages, season results, draft capital, and a trade desk. Production: https://realupvoteleague.com.

## Start

Use Node.js 22 or newer. Run `npm ci`, then `npm start`, and open http://localhost:4173. Keep the server running. Google permits localhost for this project; the numeric 127.0.0.1 address is not authorized for Google sign-in.

League changes save on this computer in `.rul-data/season.json`, not in browser storage. Back up that private folder separately. Never put `.rul-data`, `.env`, credentials, or `node_modules` in the public deployment or source archive.

## Access

- The verified Google account **jmebben18@gmail.com** is the permanent league owner and commissioner.
- Other Google accounts see **Waiting for commissioner approval**. Their verified account request appears in the commissioner's **Account approvals** list.
- Select a team and choose **Approve & assign**. Only one account can manage each team. Remove an existing assignment before replacing it.
- The league owner can choose **Make commissioner** for any account that has signed in. Delegated commissioner access can be removed later and cannot remove or replace the permanent owner.
- Managers can choose **Refresh access** or sign in again after approval.
- Assigned managers can submit exactly four players from their own team's current roster. They cannot edit scores, approve accounts, or complete trades.
- The commissioner can change scores, manage every lineup, approve or revoke GM assignments, and complete trades.
- Each team has a shareable page at `#team/team-name` with its record, roster statistics, draft capital, and recent results. Every player has a shareable page at `#player/player-id` with season stats, RUL WAR, and game history. RUL WAR estimates upvotes above a replacement scorer, divided by the median winning margin; its baseline uses the bottom quartile of active scorers with two or more games, and it appears after at least four qualify.
- The server verifies Google identity and permissions on every write. Roles sent by a browser are not trusted. Pending accounts have no editing access. Approval emails are visible only to the commissioner.

The displayed GM handles supplied with the rosters are separate from Google access assignments.

## Season results

All nine supplied finals are included: four Week 1 games, four Week 2 games, and Dragons–Supersonics in Week 3. They feed the standings, schedule, and player statistics.

As confirmed, totals use player sums: Week 1 Doom **3,793**, Week 2 Angels **4,496**, Week 3 Dragons **4,063**. Historical team membership is preserved, including @richer on Dragons and @mistermuyrico on Revolution in Week 1. @ilovesports236 maps to @il0vesports236. @67fan and @andy15r retain historical statistics without being added to the active rosters.

Phantoms, Kittens, Spiders, and Plague results display the confirmed current names Dragons, Doom, Supersonics, and Hustlers. There are 62 active players plus two historical players in the statistics list.

The schedule includes 40 games over 10 weeks and three separate All-Star events. Standings use wins, fewer losses, scored upvotes, then team name. Zero counts as a game played; a blank is DNP. Parenthetical penalty annotations are not subtracted twice.

## Score entry

Sign in as commissioner, choose a scheduled matchup or **Enter scores**, then enter scores or paste/import a single matchup. Review unknown handles and mismatched totals before saving. Saved final results update all statistics. Draft results are private to the commissioner and excluded from standings. Editing an existing result replaces it. Historical results retain the players from that game even after a trade.

## Draft capital and trades

All 48 supplied Season 3 picks are assigned once to their current owner and appear on the Draft capital page and team profiles.

The supplied past trades and rebrands are recorded as history. They are not replayed against the current roster and draft-capital list. Historical overall pick numbers remain as written; no team or season is guessed.

For new trades, sign in as commissioner and open **Trades & moves**. Paste one trade, review the matched moves, then confirm. Example format only:

```
Dragons Receive:
@stanks
Hustlers S3 Sixth

Hustlers Receive:
@aidan
```

Use exact current roster handles and the original team, season, and round for picks. Old team names, ordinal numbers, worded rounds, common Receive/Recieve/Get headings, and multi-team trades are supported. Overall numbers such as “Pick #23” need clarification before they can be processed.

The server independently checks every asset and its owner. Players and picks move together in one save. A stale review, duplicate asset, unknown player, or ownership conflict prevents the entire trade. Traded players leave upcoming submitted lineups, which are marked for an update; completed game records remain intact.

## Live deployment setup

Deploy this folder as the application root with its `api/rul.js` server function and install the package dependencies. The old site's APIs are separate and are not secured or replaced by merely copying this folder underneath that site.

For shared storage, configure the server-only `FIREBASE_SERVICE_ACCOUNT_JSON` for project `rul-upvote-pickem`. Review the existing Firestore rules so client access to `rul_redesign_private/**` is denied, including any overlapping broad allow rules. Only then set `RUL_FIRESTORE_RULES_CONFIRMED=1`. The API uses a private document at `rul_redesign_private/season_2026` and transactions for shared edits. Without this configuration, deployed writes fail closed rather than saving locally or pretending success.

Authorize the final site's domain in the Firebase Google sign-in settings. Keep service-account credentials out of client code and deployment downloads. Use server environment variables; do not create or upload a public credential file.

Real Google account login and production shared saving must be verified on the configured deployment. Local automated verification covers identity checks, approval and revocation, private request visibility, team permissions, concurrent edits, all supplied results, draft ownership, and atomic trades. The local browser verification confirms the public results and standings. No live data has been replaced.
