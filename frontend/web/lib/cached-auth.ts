import { cache } from "react";
import { getSessionUserAccess } from "@scouting-platform/core";
import { auth } from "../auth";

/**
 * Request-scoped cached version of auth().
 *
 * In the App Router, `layout.tsx` and `page.tsx` both call `auth()` within
 * the same request.  Without deduplication each call independently verifies
 * the JWT.  `React.cache` ensures the work happens only once per request
 * while every call-site still gets the resolved session.
 */
export const getSession = cache(async () => {
  const session = await auth();
  const userId = session?.user?.id;

  if (!session?.user || !userId) {
    return null;
  }

  const access = await getSessionUserAccess({
    userId,
    passwordChangedAt: session.user.passwordChangedAt ?? null,
    sessionIssuedAt: session.user.sessionIssuedAt ?? null,
  });

  if (!access) {
    return null;
  }

  return {
    ...session,
    user: {
      ...session.user,
      id: access.id,
      role: access.role,
    },
  };
});
