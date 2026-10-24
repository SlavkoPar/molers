# Molers: call log with voice messages

Molers keeps a log of phone calls for a team. Each call can have notes, a price, and a voice
message, which is turned into text automatically. Calls are grouped into **workspaces**
(one per business or team), and there are reports by date and by user.

- [Using the app](#using-the-app)
- [Recording a phone call](#recording-a-phone-call)
- [Sending calls from the mobile app](#sending-calls-from-the-mobile-app)
- [Setting up and deploying](#setting-up-and-deploying)
- [Troubleshooting](#troubleshooting)

---

## Using the app

### Signing in

There are two ways to sign in. Both create your account the first time you use them.

| Method | How it works |
|---|---|
| **Email link** | Type your email and press **Email me a link**. You receive an email with a link. Open it and you are signed in. The link works **once** and expires after **one hour**. No password is needed. |
| **Google** | Press the Google button and choose your account. |

Check your spam folder if the email does not arrive. Use **Use another email** on the
confirmation screen if you typed the address wrong.

Use the **same method every time**. If you sign in with Google first, an email link for that
address later leads to the same account. The other way round, an account created by email link
and a Google sign-in with the same address are two separate accounts.

### Setting up your workspace

The first time you sign in you are asked to **set up your workspace**:

1. **WorkSpace**: the name of your business or team.
2. **Member emails**: the addresses of the people who may use the workspace with you. Write one
   per line, or separate them with commas. You can leave it empty and add people later.

Whoever creates the workspace is its **owner**. People whose address is on the member list join
automatically the first time they sign in with that address, either by email link or with
Google.

Good to know:

- An email address can belong to **one workspace only**. If an address is already in another
  workspace, saving the list shows which one.
- Only the **owner** can edit the workspace. Open the round profile icon at the top right and
  choose **Edit workspace**.

### Who sees what

| | Owner | Member |
|---|---|---|
| Calls list and details | **All** calls in the workspace | Only the calls **they entered themselves** |
| Reports | By date, By user and date, By date and user | By date (their own calls) |
| Edit the workspace | Yes | No |

Calls that arrive from the mobile app (see below) have no recorded author. Only the owner sees
them.

### The profile menu

The round icon at the top right opens a menu with your name and email, **Edit workspace**
(owners only), a switch between **light and dark theme**, and **Sign out**. The theme is
remembered in your browser.

### Calls

The **Calls** tab lists your calls, newest first, 25 to a page.

- **Search** looks in the phone number, name, comment and transcript.
- A 🎙 in the last column means the call has a voice message.
- **Click a call** to open its details: all the fields, a player for the voice message, and the
  transcript. **← Back to calls** returns to the list.

### Adding a call

Open **New call** and fill in the form. Only the phone number and the date and time are
required; the time starts as "now".

| Field | Notes |
|---|---|
| Phone | With the country code, for example `+381...` |
| Called at | Date and time of the call |
| Type | Incoming, Outgoing or Missed |
| Duration | In seconds |
| Price | An amount, for example `12.50` |
| Name, Address, Location, Comment | Free text |

Press **Save call**. You are taken back to the list.

A call with the same workspace, phone number and time is never saved twice.

### Recording a voice message in the browser

At the bottom of the **New call** form, the **Voice message** box records from your computer's
microphone.

1. Choose your **Microphone** from the list. The list shows every microphone the browser can
   see, including a webcam's. Your choice is remembered.
2. Press **Test microphone** and speak. The level bar should move. Press **Stop test**.
3. Press **Record**, speak, then **Stop**. A level bar is shown while recording.
4. Play the recording back. Use **Record again** or **Remove** if you are not happy with it.
5. Press **Save call**.

The browser asks for permission to use the microphone the first time. If you refuse, change it
in the lock icon next to the address bar.

If the recording is silent, a red notice tells you so, because the microphone picked up nothing.
Choose another microphone from the list, check that it is not muted in your system sound
settings, and test it again.

> The web form can record, but it cannot pick an audio file that already exists. To add a
> recording made on a phone, use the mobile app (see below).

### Transcripts

Every new voice message is turned into text automatically a few seconds after it is saved. The
language is Serbian (`sr-RS`) unless the server is set up differently. Open the call to read
it; the page checks for it by itself.

- Press **Transcribe** (or **Transcribe again**) to run it again.
- A transcript that arrives together with the call (for example from the mobile app) is never
  replaced by the automatic run. **Transcribe again** does replace it.

### Reports

The **Reports** tab groups your calls. Choose the dates with **From** and **To** (the last 30
days by default). Each group shows the number of calls, the total duration and the total price,
and opens to list its calls; click a call to see it.

| Report | Who | Groups |
|---|---|---|
| **By date** | Everyone | One group per day |
| **By user, date** | Owner | Each person, then their days |
| **By date, user** | Owner | Each day, then the people who made calls |

Days begin and end at midnight in **your own time zone**. A report shows at most the newest
5,000 calls; narrow the dates to see the rest. Calls without a recorded author appear under
"Unknown user".

### Workspaces tab (administrator)

If you are signed in as an administrator, a **Workspaces** tab lists **every** workspace with
its owner, members and number of calls. Click one to see all of its calls and open any call,
including its voice message. This view is read-only.

Administrators are the addresses in the server setting `ADMIN_EMAILS` (see below). Be careful
who you add: an administrator sees all customers' calls and recordings.

---

## Recording a phone call

Molers does not record phone calls by itself. A call has to be recorded on the phone, and the
recording is then added to the call. Some phones can do this directly; many cannot. The
recording itself is made by the phone, not by this app.

> **Before you record anyone: tell them, and check the law.** In many countries you may not
> record a call without the other person's consent, and in some places call recording is
> prohibited altogether. Recorded voices are also personal data. The built-in recorders
> described below usually announce the recording to everyone on the call; that announcement does
> not replace getting consent where the law requires it. This is not legal advice. Check the
> rules where you and the other person are.

What follows was checked in October 2026. Availability depends on the phone model, software
version, language and **country**, and it changes with updates, so check your own phone.

### iPhone

- Built in since **iOS 18.1**: during a call, tap the **record** button on the call screen. The
  other person hears an announcement that the call is being recorded. The recording is saved in
  the **Notes** app, together with a transcript where the language is supported.
- **Not available in some regions.** Apple lists the European Union, Russia, Turkey, Saudi
  Arabia, the United Arab Emirates, Egypt, Nigeria, South Africa and others. If your phone is
  set to one of those regions, there is no recording button.
- Apple summaries need a phone that supports Apple Intelligence. Plain recording does not.
- Apple's pages: [Record and transcribe a call on iPhone](https://support.apple.com/guide/iphone/record-and-transcribe-a-call-iph57c6590e9/ios)
  and [How to record and transcribe a call](https://support.apple.com/en-us/121583).

### Android: Google Phone app (Pixel and some other phones)

- The Google **Phone** app can record calls on Pixel 6 and newer (Android 14 or later) and on
  some other makes. During a call, tap **Record**. Everyone on the call hears an announcement.
- Google has been extending it to more countries during 2026, except where recording is
  prohibited. If the button is missing, update the Phone app and the system.
- More: [9to5Google on the 2026 rollout](https://9to5google.com/2026/02/19/pixel-call-recording-international/).

### Android: Samsung Galaxy

- The Samsung **Phone** app has call recording on many models, but Samsung removes it in some
  countries because of local rules.
- To turn it on: **Phone** app → ⋮ (three dots) → **Settings** → **Record calls**. You can
  record all calls, calls from numbers not in your contacts, or chosen numbers only. The steps
  differ a little between One UI versions.
- There is usually also a button on the call screen to record the current call. Samsung's page
  says recording may not work during Wi-Fi calls.
- Samsung's guide: [How to record calls on your Samsung Galaxy phone](https://www.samsung.com/sa_en/support/mobile-devices/how-to-use-the-call-recording-feature-on-your-samsung-galaxy-smartphone/)

### Other Android phones

Xiaomi, OnePlus, Oppo, Realme, Vivo and others often include a call recorder in their own Phone
app, but it depends on the model and the country (it is often missing on phones sold in
Europe). Look for a **Record** button during a call, or for "Call recording" in the Phone app's
settings. Check your phone's manual.

### Recorder apps from the store

On recent Android versions (from about Android 10) ordinary recorder apps are **blocked from
hearing the other side of a call**; they usually capture only your own voice, or silence. Do
not count on them. On iPhone they cannot record calls at all.

### If your phone cannot record calls

- Put the call on **speakerphone** and record it with a second device. The quality is lower and
  you still need the other person's consent.
- Type a summary into the **Comment** field of the call instead.
- Ask the other person to send a **voice message** (WhatsApp, Viber or similar) with what they
  want to say.

### Getting the recording into Molers

1. Record the call with your phone's built-in recorder (above).
2. Find the recording (iPhone: Notes; Android: the Phone app's call details or the recordings
   folder).
3. Send it to the server together with the call, from the mobile app or any other program, as
   described in the next section. The web form cannot upload an existing file.

Voice messages from any device are stored as **m4a** (AAC). Browsers record in other formats;
the server converts them. The file limit is 25 MB per upload.

---

## Sending calls from the mobile app

The mobile app sends a call to the server with `POST /api/calls` and an API key.

- **Address:** `https://<your-service>.onrender.com/api/calls`
- **Key:** the header `X-API-Key: <API_KEY>` (an `Authorization: Bearer <API_KEY>` header also
  works).
- **Workspace:** every call must name its workspace, either `workSpace` (the name) or
  `workspaceId`.

**As a form with the voice file** (one call):

```js
const form = new FormData();
form.append('workSpace', 'AutoPlac');
form.append('phone', call.phone);
form.append('calledAt', call.calledAt);               // ISO time, e.g. 2026-10-19T08:30:00.000Z
form.append('callType', call.callType);
form.append('durationSeconds', String(call.durationSeconds));
form.append('voiceMessageMs', String(call.voiceMessageMs));
form.append('voice', { uri: call.voiceUri, name: 'voice.m4a', type: 'audio/mp4' });

await fetch(`${API_URL}/api/calls`, {
  method: 'POST',
  headers: { 'X-API-Key': API_KEY },   // do not set Content-Type; React Native adds it
  body: form,
});
```

**As XML** (one call or an export of many): send a `<calls>` document with
`Content-Type: application/xml`. A recording goes inside a call as base64 text in
`<voiceMessage>`.

```xml
<calls>
  <call>
    <workSpace>AutoPlac</workSpace>
    <calledAt>2026-10-08T13:53:15.059Z</calledAt>
    <phone>+381648319424</phone>
    <name>Zoki Nelt</name>
    <callType>incoming</callType>
    <durationSeconds>19</durationSeconds>
    <voiceMessageMs>4200</voiceMessageMs>
    <voiceMessage>BASE64…</voiceMessage>
  </call>
</calls>
```

Fields: `phone` and `calledAt` are required. Optional: `name`, `address`, `comment`, `price` (an
amount) or `priceCents`, `callType`, `durationSeconds`, `location`, `numberLabel`, `countryIso`,
`isVideo`, `voiceMessageMs`, `transcript`.

**Replies:** `201` with `{received, inserted, updated, skipped, ids}` when something was
stored; `200` when everything was already there (sending the same export twice is safe); `400`
with a readable `error` (one bad call rejects the whole upload and nothing is stored); `401`
for a wrong key; `413` over 25 MB.

Other endpoints that accept the same key: `GET /api/calls?workspaceId=…` (list),
`GET /api/calls/<id>?workspaceId=…` (one call), `GET /api/calls/<id>/voice` (the recording),
and `POST /api/transcribe` (speech to text; send `{audio, durationMs, languageCode}` with the
audio as base64).

A key inside a mobile app can be extracted by anyone who unpacks it. Treat it as semi-public,
and change `API_KEY` on the server if it leaks.

---

## Setting up and deploying

### Running it on your computer

You need Python 3.13 or newer and Node 22 or newer with Yarn.

```
python -m venv .venv
.venv\Scripts\activate                  # on macOS/Linux: source .venv/bin/activate
pip install -r backend/requirements.txt

cd backend
copy .env.example .env                  # then edit .env
python app.py                           # http://localhost:5000

# in a second terminal
cd frontend
yarn install
yarn dev                                # http://localhost:5173  (open this one)
```

Create `frontend/.env` containing `VITE_GOOGLE_CLIENT_ID=<your Google client ID>`.

Without mail settings, sign-in **links are printed in the terminal that runs the backend**:
look for `Sign-in link for you@…` and open that address.

### Settings (environment variables)

Locally they go in `backend/.env`; on Render, in the service's **Environment** tab.

| Name | What it is |
|---|---|
| `GOOGLE_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID` | Your Google OAuth client ID (the same value in both). Add your site address under *Authorized JavaScript origins* in Google Cloud. |
| `SECRET_KEY` | A long random string that signs login cookies. Render generates one. |
| `API_KEY` | The key the mobile app uses. Make one with `python -c "import secrets; print(secrets.token_urlsafe(32))"`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Mail server for the sign-in links (any SMTP service; with Gmail, use an *app password*). `SMTP_FROM` must be a full address. |
| `APP_BASE_URL` | Only if you use your own domain; links default to the Render address. |
| `SPEECH_SERVER_URL`, `SPEECH_SERVER_TOKEN`, `SPEECH_LANGUAGE` | The speech-to-text service and its language (default `sr-RS`). |
| `ADMIN_EMAILS` | Comma-separated administrator addresses. |
| `DB_PATH` | Where the SQLite database file lives (`/var/data/my.db` on Render). |
| `PRODUCTION` | Set to `1` on the server. Requires `SECRET_KEY` and mail settings, and turns on secure cookies. |

Never put the real values in the code or in git. `.env` files are ignored by git.

### Deploying to Render

The repository has a `Dockerfile` and a `render.yaml`. One service serves both the website and
the API.

1. Push the repository to GitHub.
2. In Render choose **New → Blueprint** and select the repository.
3. Fill in the values it asks for (see the table above).
4. Add the service's address to Google Cloud under *Authorized JavaScript origins*.

The blueprint uses a paid instance with a persistent disk, because the database is a file; on
a free instance all data would be lost at every deploy. Run **one instance only**. Render
may also block outgoing mail ports on free instances; see Render's current documentation.

---

## Troubleshooting

| Problem | What to do |
|---|---|
| "Signing in by email is not set up on this server" | The mail settings (`SMTP_HOST`, `SMTP_FROM`, …) are missing on the server. |
| The sign-in email does not arrive | Check spam. In the server log, `Sign-in link sent to …` means it was sent; `Could not send the sign-in link … <reason>` explains why not. Common causes: a wrong app password, or a typo in `SMTP_FROM`. |
| "This sign-in link is invalid, already used, or has expired" | A link works once and for one hour. Ask for a new one. |
| The voice recording is silent | Choose another microphone, use **Test microphone**, and check that the microphone is not muted in the system sound settings. |
| No transcript | Press **Transcribe**. If it reports an error, the speech service settings may be wrong. |
| A member cannot see calls | Members see only calls they entered. Calls from the mobile app are visible to the owner only. |
| Google sign-in shows "Access blocked" or `origin_mismatch` | Add the exact site address to *Authorized JavaScript origins* in Google Cloud and wait a few minutes. |
