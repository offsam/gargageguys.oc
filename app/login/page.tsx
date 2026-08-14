import { signInAction } from "@/app/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Garage Guys</h1>
        <p>Sign in to CRM, Search, Dispatch, Finance, or Field.</p>
        {params.error ? <div className="error">{params.error}</div> : null}
        <form action={signInAction}>
          <input type="hidden" name="next" value={params.next || ""} />
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="username" />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
          <button type="submit">Sign in</button>
        </form>
      </div>
    </div>
  );
}
