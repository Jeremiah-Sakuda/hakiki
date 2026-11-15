import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  analyzeLocal,
  checkWorld,
  cloudConfigured,
  cloudModel,
  configured,
  localAvailability,
  prepareLocal,
  refreshPlaybook,
  summarizeProfile,
} from "./ai";
import {
  deleteProfiles,
  examples,
  extractFeatures,
  loadProfiles,
  parseWhatsApp,
  rulesResult,
  sampleProfile,
  saveProfiles,
  signalsFor,
  profileInput,
  type Chat,
  type Features,
  type LocalResult,
  type Profile,
  type Receipt,
  type WorldResult,
} from "./domain";

function Icon({ name = "check", size = 20 }: { name?: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 6" />
      </>
    ),
    spark: (
      <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />
    ),
    cloud: (
      <path d="M7 18a5 5 0 1 1 .5-10A6 6 0 0 1 19 11a3.5 3.5 0 0 1-.5 7Z" />
    ),
    device: (
      <>
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8m-4-4v4" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10v1" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6M8 13h8m-8 4h5" />
      </>
    ),
    phone: (
      <path d="M6 3h4l1 5-3 2a14 14 0 0 0 6 6l2-3 5 1v4a3 3 0 0 1-3 3A18 18 0 0 1 3 6a3 3 0 0 1 3-3Z" />
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.info}
    </svg>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-header">
        <h2>{title}</h2>
        <button
          className="icon-btn"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
function Download({
  value,
  name,
  children,
}: {
  value: unknown;
  name: string;
  children: ReactNode;
}) {
  return (
    <button
      className="text-button"
      onClick={() => {
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(value, null, 2)], {
            type: "application/json",
          }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}
    >
      {children} <Icon name="arrow" size={16} />
    </button>
  );
}

export default function App() {
  const [tab, setTab] = useState("check");
  const [modal, setModal] = useState<
    "privacy" | "how" | "receipt" | "setup" | null
  >(null);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState("");
  const [number, setNumber] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>(loadProfiles);
  const [local, setLocal] = useState<LocalResult | null>(null);
  const [world, setWorld] = useState<WorldResult | null>(null);
  const [features, setFeatures] = useState<Features | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [stage, setStage] = useState<"compose" | "review" | "result">(
    "compose",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [availability, setAvailability] = useState("checking");
  const [localReady, setLocalReady] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [playbook, setPlaybook] = useState("2026-11-15");
  const [chat, setChat] = useState<Chat | null>(null);
  const [speaker, setSpeaker] = useState("");
  const [contactName, setContactName] = useState("");
  const [trusted, setTrusted] = useState("");
  const [permission, setPermission] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Profile | null>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const epoch = useRef(0);
  const profile = [...profiles, sampleProfile].find((p) => p.id === selected);
  useEffect(() => {
    localAvailability().then(setAvailability);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (stage !== "compose") resultHeading.current?.focus();
  }, [stage]);
  function reset() {
    epoch.current++;
    setProfileDraft(null);
    setBusy(false);
    setMessage("");
    setSelected("");
    setNumber("");
    setLocal(null);
    setWorld(null);
    setFeatures(null);
    setReceipts([]);
    setError("");
    setStage("compose");
  }
  async function enableLocal() {
    setError("");
    setProgress(0);
    try {
      await prepareLocal((v) => setProgress(Math.round(v * 100)));
      setLocalReady(true);
      setAvailability("available");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  }
  async function inspect(e: FormEvent) {
    e.preventDefault();
    if (!message.trim() || busy) return;
    setBusy(true);
    setError("");
    const current = ++epoch.current;
    let result = rulesResult(message, profile, number);
    if (localReady) {
      try {
        result = await analyzeLocal(message, profile, number);
      } catch {
        result.note =
          "On-device AI could not finish. These observations use text rules only; writing-style comparison is unavailable.";
      }
    }
    if (epoch.current !== current) return;
    setLocal(result);
    setFeatures(extractFeatures(message));
    setStage("review");
    setBusy(false);
  }
  async function send() {
    if (!features || busy || !online) return;
    setBusy(true);
    setError("");
    const current = epoch.current;
    try {
      const r = await checkWorld(features, (receipt) => {
        if (epoch.current === current)
          setReceipts((old) => [
            ...old.filter((x) => x.id !== receipt.id),
            receipt,
          ]);
      });
      if (epoch.current === current) {
        setWorld(r);
        setStage("result");
        refreshPlaybook().then(setPlaybook);
      }
    } catch (e) {
      if (epoch.current === current) setError((e as Error).message);
    } finally {
      if (epoch.current === current) setBusy(false);
    }
  }
  async function importChat(file?: File) {
    if (!file || busy) return;
    setBusy(true);
    setChat(null);
    setProfileDraft(null);
    setPermission(false);
    setTrusted("");
    setError("");
    try {
      if (file.size > 2_000_000)
        throw new Error("Choose a text export smaller than 2 MB.");
      const parsed = parseWhatsApp(await file.text());
      setChat(parsed);
      setSpeaker(parsed.participants[0]);
      setContactName(parsed.participants[0]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function addContact(e: FormEvent) {
    e.preventDefault();
    if (!chat || !permission || busy) return;
    setBusy(true);
    setError("");
    const current = ++epoch.current;
    try {
      const messages = chat.messages
        .filter((m) => m.speaker === speaker)
        .map((m) => m.text);
      const style = await summarizeProfile(messages);
      if (current !== epoch.current) return;
      const entry: Profile = {
        id: crypto.randomUUID(),
        name: contactName.trim(),
        trustedNumber: trusted.trim(),
        style,
        sample: false,
        sampleCount: profileInput(messages).length,
      };
      setProfileDraft(entry);
      setChat(null);
      setTrusted("");
      setContactName("");
    } catch (e) {
      if (current === epoch.current) setError((e as Error).message);
    } finally {
      if (current === epoch.current) setBusy(false);
    }
  }
  function removeContact(id: string) {
    try {
      const next = profiles.filter((p) => p.id !== id);
      saveProfiles(next);
      setProfiles(next);
      if (selected === id) reset();
    } catch {
      setError(
        "Browser storage could not be updated. Try again or clear this site’s stored data.",
      );
    }
  }
  const localCard = local && (
    <section className="finding">
      <div className="finding-head">
        <span className="round-icon">
          <Icon name="device" />
        </span>
        <div>
          <h3>What your device noticed</h3>
          <span className="eyebrow muted">
            {local.kind === "model"
              ? "On-device AI + text rules"
              : "Text rules · no AI comparison"}
          </span>
        </div>
      </div>
      {local.signals.length ? (
        <ul className="signal-list">
          {local.signals.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      ) : (
        <p>
          No explicit pressure pattern was picked up by the text rules. This
          does not establish who sent the message.
        </p>
      )}
      {local.personal && profile && (
        <div className="personal">
          <h4>Compared with {profile.name}</h4>
          <p>
            Language: {local.personal.languageMatch}. Tone:{" "}
            {local.personal.toneMatch}.
          </p>
          {local.personal.observations.map((s, i) => (
            <p key={i}>{s}</p>
          ))}
          <small>
            Writing context is experimental. It may miss changes or flag normal
            ones, and cannot confirm who sent a message.
          </small>
        </div>
      )}
      <p className="small muted">{local.note}</p>
      <p className="small">
        Sender number:{" "}
        {local.number === "unknown"
          ? "unavailable for comparison."
          : local.number === "matches"
            ? "matches the saved number you entered. This does not authenticate the sender."
            : "differs from the saved number you entered. A new number can be genuine."}
      </p>
    </section>
  );
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("check");
          }}
          aria-label="Hakiki home"
        >
          <span className="brand-mark">
            <Icon size={24} />
          </span>
          hakiki<span className="brand-dot">.</span>
        </a>
        <nav aria-label="Main navigation">
          <button
            className={tab === "check" ? "active" : ""}
            disabled={busy}
            onClick={() => setTab("check")}
          >
            Check a message
          </button>
          <button
            className={tab === "people" ? "active" : ""}
            disabled={busy}
            onClick={() => setTab("people")}
          >
            Your people
            {profiles.length > 0 && (
              <span className="count">{profiles.length}</span>
            )}
          </button>
          <button onClick={() => setModal("how")}>How it works</button>
        </nav>
        <button className="privacy-pill" onClick={() => setModal("privacy")}>
          <Icon name="lock" size={15} />
          Private by design
        </button>
      </header>
      <main id="main">
        <div className="status-line">
          <span>
            <i className={online ? "dot" : "dot offline"} />
            {online
              ? "Ready when you are"
              : "You’re offline · local tools still work"}
          </span>
          <button onClick={() => setModal("setup")}>
            <Icon name="device" size={14} />
            {localReady ? "On-device AI ready" : "Device setup"}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
        {error && (
          <div className="error" role="alert">
            <Icon name="info" />
            <span>{error}</span>
            <button
              aria-label="Dismiss notification"
              onClick={() => setError("")}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
        {tab === "check" && (
          <>
            {stage === "compose" ? (
              <>
                <div className="hero">
                  <div className="eyebrow">
                    <span className="mini-line" />A SECOND OPINION, CLOSE TO
                    HOME
                  </div>
                  <h1>
                    A little pause.
                    <br />A <em>clearer picture.</em>
                  </h1>
                  <p>
                    When someone you know asks for money, it’s okay to
                    double-check.
                    <br className="desktop" /> Make sense of the message. Find a
                    trusted way to reach them.
                  </p>
                </div>
                <div className="workspace">
                  <form className="composer" onSubmit={inspect}>
                    <div className="section-title">
                      <span className="step">01</span>
                      <h2>Let’s look at the message</h2>
                      <span className="text-label">Stays on this device</span>
                    </div>
                    <label htmlFor="message" className="sr-only">
                      Message to check
                    </label>
                    <textarea
                      disabled={busy}
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={4000}
                      placeholder={
                        "Paste the message here…\n\nA text from a new number. An urgent family request. Something that just feels a little different."
                      }
                      required
                    />
                    <div className="textarea-footer">
                      <span>
                        <Icon name="lock" size={13} /> Your words stay here
                      </span>
                      <span>{message.length.toLocaleString()} / 4,000</span>
                    </div>
                    <div className="form-bottom">
                      <label htmlFor="contact">
                        Who does it claim to be from?{" "}
                        <span className="muted">Optional</span>
                      </label>
                      <select
                        disabled={busy}
                        id="contact"
                        value={selected}
                        onChange={(e) => setSelected(e.target.value)}
                      >
                        <option value="">I’ll check without a contact</option>
                        {profiles.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                        <option value={sampleProfile.id}>
                          {sampleProfile.name} · fictional profile
                        </option>
                      </select>
                      {selected && (
                        <>
                          <label htmlFor="sender-number">
                            Sender’s number{" "}
                            <span className="muted">
                              Optional · entered by you
                            </span>
                          </label>
                          <input
                            id="sender-number"
                            disabled={busy}
                            type="tel"
                            maxLength={30}
                            value={number}
                            onChange={(e) => setNumber(e.target.value)}
                            placeholder="Only if you have it independently"
                          />
                          {profile?.sample && (
                            <p className="small muted">
                              This fictional profile is for trying the
                              experience. It does not represent someone you
                              know.
                            </p>
                          )}
                        </>
                      )}
                      <button
                        className="primary"
                        disabled={!message.trim() || busy}
                        type="submit"
                      >
                        {busy
                          ? "Reading on your device…"
                          : "Review this message"}
                        <Icon name="arrow" />
                      </button>
                      <p className="button-note">
                        Nothing is sent to the cloud at this step.
                      </p>
                    </div>
                  </form>
                  <aside className="companion">
                    <div className="illustration" aria-hidden="true">
                      <div className="orbit one" />
                      <div className="orbit two" />
                      <span className="mini-bubble">hey, is this you?</span>
                      <div className="letter-card">
                        <span className="tiny-avatar">a</span>
                        <span className="sketch-line" />
                        <span className="sketch-line short" />
                        <div className="letter-stamp">
                          <Icon name="check" size={26} />
                        </div>
                      </div>
                      <span className="float-lock">
                        <Icon name="lock" size={22} />
                      </span>
                      <span className="star">✳</span>
                    </div>
                    <span className="eyebrow">A CHECK, NOT A VERDICT</span>
                    <h2>
                      Your people.
                      <br />
                      Your peace of mind.
                    </h2>
                    <p>
                      Hakiki looks for pressure in a request and, when
                      available, changes from a person’s usual writing.
                    </p>
                    <div className="aside-rule" />
                    <div className="aside-note">
                      <Icon name="phone" />
                      <p>
                        The best next step is always a real conversation through
                        a contact route you already trust.
                      </p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setModal("how")}
                    >
                      Meet your second opinion <Icon name="arrow" size={16} />
                    </button>
                  </aside>
                </div>
                <section className="examples">
                  <div className="examples-heading">
                    <h2>Just exploring? Try a message.</h2>
                    <span>Fictional examples. No personal data needed.</span>
                  </div>
                  <div className="example-grid">
                    {examples.map((e, i) => (
                      <button
                        disabled={busy}
                        key={e.name}
                        onClick={() => {
                          setMessage(e.text);
                          setSelected(sampleProfile.id);
                          document.getElementById("message")?.focus();
                        }}
                      >
                        <span className="example-number">0{i + 1}</span>
                        <span>
                          <strong>{e.name}</strong>
                          <small>{e.tag}</small>
                        </span>
                        <Icon name="arrow" size={18} />
                      </button>
                    ))}
                  </div>
                </section>
              </>
            ) : (
              <div className="results-layout">
                <div>
                  <button
                    className="text-button back"
                    disabled={busy}
                    onClick={() => {
                      setStage("compose");
                      setWorld(null);
                      setLocal(null);
                      setFeatures(null);
                      setError("");
                    }}
                  >
                    ← Edit this message
                  </button>
                  <span className="eyebrow">
                    {stage === "review"
                      ? "02 · YOUR SECOND OPINION"
                      : "03 · A TRUSTED NEXT STEP"}
                  </span>
                  <h1
                    className="result-title"
                    ref={resultHeading}
                    tabIndex={-1}
                  >
                    {stage === "review"
                      ? "A moment to look closer."
                      : "Now, reach out directly."}
                  </h1>
                  <p className="lead">
                    These are observations, not proof of who sent the request.
                  </p>
                  <section className="finding message-summary">
                    <h3>The request you’re checking</h3>
                    <blockquote>{message}</blockquote>
                    <p className="small muted">
                      Claims to be from:{" "}
                      {profile?.name || "someone you know (not specified)"}.
                      Identity remains unverified.
                    </p>
                  </section>
                  {localCard}
                  {world && (
                    <section className="finding">
                      <div className="finding-head">
                        <span className="round-icon">
                          <Icon name="cloud" />
                        </span>
                        <div>
                          <h3>What the cloud found</h3>
                          <span className="eyebrow muted">
                            {world.grounded
                              ? "Sources from Google Search"
                              : "General model response · no search sources returned"}
                          </span>
                        </div>
                      </div>
                      <p className="world-text">{world.text}</p>
                      {world.sources.length > 0 && (
                        <ul className="sources">
                          {world.sources.map((s, i) => (
                            <li key={i}>
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {s.title} ↗
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                      {world.searchHtml && (
                        <iframe
                          className="search-suggestions"
                          title="Google Search suggestions"
                          sandbox="allow-popups allow-popups-to-escape-sandbox"
                          referrerPolicy="no-referrer"
                          srcDoc={world.searchHtml}
                        />
                      )}
                    </section>
                  )}
                  {stage === "result" && !world && (
                    <div className="notice">
                      <Icon name="cloud" />
                      <p>
                        {receipts.length
                          ? "Cloud check unavailable after an approved attempt. See the privacy receipt for its status. This result includes local observations only."
                          : "Cloud check skipped. This result includes local observations only."}
                      </p>
                    </div>
                  )}
                  <section className="verify-card">
                    <Icon name="phone" size={26} />
                    <div>
                      <span className="eyebrow">YOUR NEXT STEP</span>
                      <h2>Check with the person, not the message.</h2>
                      <p>
                        Use a number or contact route you saved before this
                        request. Avoid numbers and links supplied in the
                        message.
                      </p>
                      {profile?.trustedNumber && (
                        <p className="saved-number">
                          Your previously saved number:{" "}
                          <strong>{profile.trustedNumber}</strong>
                          <small>
                            Saved by you · not independently authenticated by
                            Hakiki
                          </small>
                        </p>
                      )}
                      <p className="script">
                        “Hey, I received a request for money. Was that really
                        you?”
                      </p>
                    </div>
                  </section>
                  <button className="secondary" onClick={reset} disabled={busy}>
                    Clear this check & start again
                  </button>
                </div>
                <aside className="review-sidebar">
                  {stage === "review" && features ? (
                    <section className="consent-card">
                      <span className="round-icon">
                        <Icon name="cloud" size={24} />
                      </span>
                      <h2>Add a wider perspective</h2>
                      <p>
                        The cloud can look for known scam patterns. Only these
                        categories will be sent. Review or correct them first.
                      </p>
                      <FeatureEditor
                        features={features}
                        setFeatures={(next) => {
                          setFeatures(next);
                          setLocal((old) =>
                            old ? { ...old, signals: signalsFor(next) } : old,
                          );
                        }}
                        disabled={busy}
                      />
                      <p className="small">
                        No message text, names, numbers, or contact history.
                        Google also receives normal connection and App Check
                        metadata.
                      </p>
                      <button
                        className="primary"
                        onClick={send}
                        disabled={busy || !online || !cloudConfigured}
                      >
                        {busy
                          ? "Checking patterns…"
                          : "Approve & check patterns"}
                        <Icon name="arrow" />
                      </button>
                      {!online && (
                        <p className="small">
                          Reconnect to use the cloud. Nothing will be sent
                          automatically.
                        </p>
                      )}
                      {!cloudConfigured && (
                        <p className="small">
                          Cloud setup isn’t available in this build. Continue
                          with local observations.
                        </p>
                      )}
                      <button
                        className="text-button skip-cloud"
                        onClick={() => setStage("result")}
                        disabled={busy}
                      >
                        Continue without the cloud →
                      </button>
                    </section>
                  ) : (
                    <section className="consent-card">
                      <span className="round-icon">
                        <Icon name="lock" size={24} />
                      </span>
                      <h2>A receipt, not a promise.</h2>
                      <p>
                        See the application AI content sent during this check,
                        along with where the analysis ran.
                      </p>
                      <button
                        className="secondary"
                        onClick={() => setModal("receipt")}
                      >
                        Open privacy receipt
                      </button>
                    </section>
                  )}
                  <div className="sidebar-caption">
                    <Icon name="lock" size={16} />
                    <span>
                      {receipts.length
                        ? `${receipts.length} cloud request${receipts.length === 1 ? "" : "s"} recorded`
                        : "No cloud AI request sent"}
                    </span>
                  </div>
                  {receipts.length > 0 && stage === "review" && (
                    <button
                      className="text-button"
                      onClick={() => setModal("receipt")}
                    >
                      Inspect the request receipt →
                    </button>
                  )}
                </aside>
              </div>
            )}
          </>
        )}
        {tab === "people" && (
          <section className="people-page">
            <span className="eyebrow">RELATIONSHIPS STAY LOCAL</span>
            <h1>
              Your people,
              <br />
              <em>on your device.</em>
            </h1>
            <p className="lead">
              Add writing context when you’re ready. You can always check a
              message without it.
            </p>
            <div className="people-grid">
              <section className="finding">
                <h2>Saved contacts</h2>
                {profiles.length === 0 ? (
                  <div className="empty">
                    <Icon name="people" size={36} />
                    <h3>A little context goes a long way.</h3>
                    <p>
                      No contacts saved yet. Save optional writing context for
                      an experimental comparison on this device.
                    </p>
                  </div>
                ) : (
                  profiles.map((p) => (
                    <article className="contact-row" key={p.id}>
                      <span className="avatar">
                        {p.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <h3>{p.name}</h3>
                        <p>
                          {p.sampleCount} messages used · stored on this browser
                        </p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => removeContact(p.id)}
                        disabled={busy}
                      >
                        Delete<span className="sr-only"> {p.name}</span>
                      </button>
                    </article>
                  ))
                )}
                {profiles.length > 0 && (
                  <button
                    className="text-button danger"
                    onClick={() => {
                      try {
                        deleteProfiles();
                        setProfiles([]);
                        reset();
                      } catch {
                        setError(
                          "Browser storage could not be updated. Try clearing this site’s stored data.",
                        );
                      }
                    }}
                  >
                    Delete all saved profiles
                  </button>
                )}
                <p className="small muted">
                  Profiles are stored in this browser, without application-level
                  encryption. Anyone with access to this browser may be able to
                  read them. Deleting a profile removes Hakiki’s saved copy.
                </p>
              </section>
              <form className="finding import-form" onSubmit={addContact}>
                <h2>Add a contact</h2>
                {profileDraft && (
                  <div className="notice">
                    <div>
                      <h3>Review before saving</h3>
                      <p>
                        The local model may repeat private details or make
                        mistakes. Remove names, numbers, quotations, and
                        anything you do not want stored. This draft has not been
                        saved.
                      </p>
                      <label htmlFor="profile-draft">
                        Writing profile for {profileDraft.name}
                      </label>
                      <textarea
                        id="profile-draft"
                        maxLength={1800}
                        value={profileDraft.style}
                        onChange={(e) =>
                          setProfileDraft({
                            ...profileDraft,
                            style: e.target.value,
                          })
                        }
                      />
                      <button
                        type="button"
                        className="primary"
                        disabled={profileDraft.style.trim().length < 10}
                        onClick={() => {
                          try {
                            const entry = {
                              ...profileDraft,
                              style: profileDraft.style.trim(),
                            };
                            const next = [...profiles, entry];
                            saveProfiles(next);
                            setProfiles(next);
                            setPermission(false);
                            reset();
                            setSelected(entry.id);
                            setTab("check");
                          } catch {
                            setError(
                              "Browser storage could not be updated. Your profile was not saved.",
                            );
                          }
                        }}
                      >
                        Save reviewed profile
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setProfileDraft(null)}
                      >
                        Discard profile draft
                      </button>
                    </div>
                  </div>
                )}
                <p>
                  Export a WhatsApp chat as text, without media. Only the
                  selected person’s messages are summarized, on this device.
                </p>
                <p className="small muted">
                  Writing context is experimental. It may miss changes or flag
                  normal ones, and cannot confirm who sent a message.
                </p>
                {!localReady && (
                  <div className="notice">
                    <Icon name="device" />
                    <p>
                      On-device AI must be ready before a profile can be
                      created.{" "}
                      <button
                        className="inline-link"
                        type="button"
                        onClick={() => setModal("setup")}
                      >
                        Check device setup
                      </button>
                    </p>
                  </div>
                )}
                <label className="upload">
                  <Icon name="file" size={28} />
                  <strong>Choose a chat export</strong>
                  <span>.txt · under 2 MB · stays local</span>
                  <input
                    aria-label="Choose a WhatsApp text export"
                    type="file"
                    disabled={busy}
                    accept=".txt,text/plain"
                    onChange={(e) => {
                      importChat(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {chat && (
                  <>
                    <label htmlFor="speaker">
                      Whose writing should be used?
                    </label>
                    <select
                      id="speaker"
                      disabled={busy}
                      value={speaker}
                      onChange={(e) => {
                        setSpeaker(e.target.value);
                        setContactName(e.target.value);
                      }}
                    >
                      {chat.participants.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                    <p className="small">
                      {
                        chat.messages.filter((m) => m.speaker === speaker)
                          .length
                      }{" "}
                      messages available. Only the most recent 40 nonempty
                      messages (up to 250 characters each) are used. The
                      original export will be discarded after the profile is
                      created.
                    </p>
                    <label htmlFor="contact-name">Contact name</label>
                    <input
                      id="contact-name"
                      disabled={busy}
                      maxLength={60}
                      required
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                    />
                    <label htmlFor="trusted-number">
                      Previously saved number{" "}
                      <span className="muted">Optional</span>
                    </label>
                    <input
                      id="trusted-number"
                      disabled={busy}
                      type="tel"
                      maxLength={30}
                      value={trusted}
                      onChange={(e) => setTrusted(e.target.value)}
                      placeholder="Use your existing address book"
                    />
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        disabled={busy}
                        checked={permission}
                        onChange={(e) => setPermission(e.target.checked)}
                      />
                      I have permission to use this chat and want to save a
                      compact profile in this browser.
                    </label>
                    <button
                      className="primary"
                      disabled={
                        busy ||
                        !localReady ||
                        !permission ||
                        profiles.length >= 30
                      }
                    >
                      {busy
                        ? "Building profile on your device…"
                        : "Create local profile"}
                      <Icon name="arrow" />
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy}
                      onClick={() => setChat(null)}
                    >
                      Discard imported text
                    </button>
                  </>
                )}
              </form>
            </div>
          </section>
        )}
        <footer>
          <a
            className="footer-brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setTab("check");
            }}
          >
            hakiki.
          </a>
          <p>Swahili for “verify.” A little care for the people who matter.</p>
          <div>
            <button onClick={() => setModal("privacy")}>Privacy</button>
            <a
              href="https://github.com/Jeremiah-Sakuda/hakiki"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open source ↗
            </a>
          </div>
        </footer>
      </main>
      {modal === "privacy" && (
        <Modal title="Your words stay close" onClose={() => setModal(null)}>
          <p>
            Raw messages, chat exports, and personal writing observations stay
            on this device. Hakiki does not certify a sender or tell you a
            request is safe.
          </p>
          <div className="privacy-list">
            <div>
              <Icon name="device" />
              <h3>On this device</h3>
              <p>
                Message analysis and optional contact profiles. Messages stay in
                memory until cleared or the tab closes. Profiles are saved only
                with your consent.
              </p>
            </div>
            <div>
              <Icon name="cloud" />
              <h3>With your approval</h3>
              <p>
                Only fixed categories such as urgency and payment method go to
                Firebase AI Logic. These still reveal limited facts about the
                request. App Check, Hosting, and Remote Config use normal
                service metadata.
              </p>
            </div>
            <div>
              <Icon name="file" />
              <h3>A check you can inspect</h3>
              <p>
                The privacy receipt shows application AI request content, not
                all network traffic or authentication tokens. Cloud providers
                may retain permitted inputs under their terms.
              </p>
            </div>
          </div>
          <p className="small">
            Local storage is not encrypted by Hakiki. We do not enable Analytics
            or collect family conversations. Grounded source links open external
            websites only when you choose them.
          </p>
          <button className="secondary" onClick={() => setModal("receipt")}>
            View this check’s receipt
          </button>
        </Modal>
      )}
      {modal === "how" && (
        <Modal
          title="Two perspectives. One thoughtful pause."
          onClose={() => setModal(null)}
        >
          <ol className="how-steps">
            <li>
              <h3>Start with the message</h3>
              <p>
                Text rules notice pressure. With a supported local model and a
                saved profile, AI can also compare writing on your device.
              </p>
            </li>
            <li>
              <h3>Choose what leaves</h3>
              <p>
                Review a few categories, then decide whether to ask the cloud
                for current scam-pattern evidence. You can skip this step.
              </p>
            </li>
            <li>
              <h3>Reach someone you trust</h3>
              <p>
                Neither model proves identity. Call through a number you already
                saved, or use another independently trusted channel before
                transferring money.
              </p>
            </li>
          </ol>
          <div className="notice">
            <Icon name="info" />
            <p>
              This is an experimental hackathon project. Real-world detection
              accuracy and user outcomes have not yet been established. English
              is the supported interface and initial evaluation language.
            </p>
          </div>
          <p className="small">
            Guidance version: {playbook}. The current source and evaluation
            limitations are available in the public repository.
          </p>
        </Modal>
      )}
      {modal === "receipt" && (
        <Modal title="Your privacy receipt" onClose={() => setModal(null)}>
          <div className="receipt-status">
            <Icon name="lock" />
            <div>
              <strong>
                {receipts.length
                  ? `${receipts.length} application AI request${receipts.length === 1 ? "" : "s"}`
                  : "Nothing sent to cloud AI"}
              </strong>
              <p>
                {local?.kind === "model"
                  ? "Personal comparison ran on device."
                  : local
                    ? "Local text rules ran. No on-device model result."
                    : "No analysis has run yet."}
              </p>
            </div>
          </div>
          <p>
            Names, message text, personal findings, and contact history are
            excluded. Service connection metadata and App Check tokens are
            outside this receipt.
          </p>
          {receipts.map((r) => (
            <details key={r.id} open>
              <summary>
                {r.status} · {new Date(r.at).toLocaleTimeString()} · {r.model}
              </summary>
              <p className="small">
                Destination: {r.endpoint}
                {r.elapsedMs ? ` · ${r.elapsedMs} ms` : ""}
              </p>
              <pre>{JSON.stringify(r.request, null, 2)}</pre>
            </details>
          ))}
          <Download
            value={{
              scope:
                "Application AI request content only; excludes infrastructure metadata",
              local: local?.kind ?? "none",
              requests: receipts,
            }}
            name="hakiki-privacy-receipt.json"
          >
            Download receipt
          </Download>
        </Modal>
      )}
      {modal === "setup" && (
        <Modal
          title="Make room for a local perspective"
          onClose={() => setModal(null)}
        >
          <div className="receipt-status">
            <Icon name="device" size={28} />
            <div>
              <strong>
                {localReady
                  ? "On-device AI is ready"
                  : availability === "unavailable"
                    ? "On-device AI is unavailable"
                    : availability === "checking"
                      ? "Checking this browser…"
                      : "Your browser can prepare on-device AI"}
              </strong>
              <p>
                Cloud configuration:{" "}
                {cloudConfigured ? "available" : "not configured"} ·{" "}
                {configured ? "Firebase connected" : "local tools only"}
              </p>
            </div>
          </div>
          <p>
            Use desktop Chrome 139 or newer. Enable{" "}
            <code>
              chrome://flags/#prompt-api-for-gemini-nano-multimodal-input
            </code>
            , restart Chrome, then return here. The model may need a one-time
            download.
          </p>
          <button
            className="primary"
            onClick={enableLocal}
            disabled={progress !== null || localReady}
          >
            {progress !== null
              ? `Preparing local model… ${progress}%`
              : localReady
                ? "Local model ready"
                : "Enable on-device AI"}
            <Icon name="device" />
          </button>
          <p className="small">
            The download contains the model, not your messages. Unsupported
            browsers can still use text rules and approved cloud categories.
            Cloud model: {cloudModel}.
          </p>
          {error && (
            <p role="alert" className="dialog-error">
              {error}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}

function FeatureEditor({
  features,
  setFeatures,
  disabled,
}: {
  features: Features;
  setFeatures: (f: Features) => void;
  disabled: boolean;
}) {
  const labels: Record<string, string> = {
    emergency_money: "Emergency money request",
    ordinary_money: "Money request",
    unknown: "Not known",
    mobile_money: "Mobile money",
    bank_transfer: "Bank transfer",
    gift_card: "Gift cards",
    crypto: "Cryptocurrency",
    immediate: "Immediate",
    not_stated: "No urgency picked up",
  };
  return (
    <fieldset disabled={disabled} className="feature-fields">
      <legend className="sr-only">Categories sent to the cloud</legend>
      {(
        [
          [
            "requestType",
            "Request",
            ["emergency_money", "ordinary_money", "unknown"],
          ],
          [
            "paymentChannel",
            "Payment",
            ["mobile_money", "bank_transfer", "gift_card", "crypto", "unknown"],
          ],
          ["urgency", "Urgency", ["immediate", "not_stated", "unknown"]],
        ] as const
      ).map(([key, label, values]) => (
        <label key={key}>
          {label}
          <select
            value={features[key]}
            onChange={(e) =>
              setFeatures({ ...features, [key]: e.target.value })
            }
          >
            {values.map((v) => (
              <option value={v} key={v}>
                {labels[v]}
              </option>
            ))}
          </select>
        </label>
      ))}
      {(
        [
          ["secrecyRequested", "Secrecy requested"],
          ["changedContactClaim", "Claims a new number"],
          ["verificationDiscouraged", "Discourages verification"],
        ] as const
      ).map(([key, label]) => (
        <label key={key}>
          {label}
          <select
            value={features[key] === null ? "unknown" : String(features[key])}
            onChange={(e) =>
              setFeatures({
                ...features,
                [key]:
                  e.target.value === "unknown"
                    ? null
                    : e.target.value === "true",
              })
            }
          >
            <option value="unknown">Not known</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
      ))}
    </fieldset>
  );
}
