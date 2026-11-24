import { SessionCards } from '../components/sessions/SessionCards';
import { TYPOGRAPHY_CLASSES } from '../designTokens';

export default function TeaFeedPage() {
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 pt-6 pb-nav-gap md:px-6">
      <h1 className={`${TYPOGRAPHY_CLASSES.h1} mb-4`}>Brewing experiences</h1>
      <SessionCards />
    </div>
  );
}
