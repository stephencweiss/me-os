-- Server-side PKCE + state for Capacitor system-browser OAuth (no WebView cookies for OAuth hop).

CREATE TABLE public.mobile_oauth_challenges (
    state text NOT NULL PRIMARY KEY,
    code_verifier text NOT NULL,
    redirect_to text,
    expires_at timestamp with time zone NOT NULL
);

CREATE INDEX mobile_oauth_challenges_expires_at_idx
    ON public.mobile_oauth_challenges (expires_at);

CREATE TABLE public.mobile_oauth_pending (
    id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token text NOT NULL,
    session_expires_at timestamp with time zone NOT NULL,
    redirect_to text,
    expires_at timestamp with time zone NOT NULL
);

CREATE INDEX mobile_oauth_pending_expires_at_idx
    ON public.mobile_oauth_pending (expires_at);

ALTER TABLE public.mobile_oauth_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_oauth_pending ENABLE ROW LEVEL SECURITY;

-- No policies: anon/authenticated cannot read; service_role bypasses RLS.
