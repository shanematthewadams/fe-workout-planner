import { Component, type ReactNode } from "react";
export class AppRecovery extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main id="main" className="main">
        <h1>The planner needs to reopen.</h1>
        <p>
          Your saved workouts have not been removed. Reopen the app to recover
          your saved plans and builder session.
        </p>
        <button onClick={() => window.location.reload()}>Reopen planner</button>
      </main>
    );
  }
}
