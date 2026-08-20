import { signInAction } from "@/app/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next || "";
  const fieldHint = next.startsWith("/field") || next.startsWith("/stock");

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Garage Guys</h1>
        <p>
          {fieldHint
            ? "Sign in to Field. Stay signed in on this phone — you will not need to log in every time."
            : "Sign in to CRM, Search, Dispatch, Finance, or Field."}
        </p>
        {params.error ? <div className="error">{params.error}</div> : null}
        <form action={signInAction}>
          <input type="hidden" name="next" value={next} />
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
          <label className="login-stay">
            <input type="checkbox" name="persist" value="1" defaultChecked />
            Stay signed in on this device
          </label>
          <button type="submit">Sign in</button>
        </form>
      </div>
    </div>
  );
}
