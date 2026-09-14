'use client';

export function GettingStarted({
  onCreateProject,
}: {
  onCreateProject: () => void;
}) {
  return (
    <div className="getting-started">
      <ol className="getting-started-steps">
        <li>
          <h3>Create a project</h3>
          <p>
            Add a client, hourly rate, and time budget. Each project keeps its
            own entries and totals.
          </p>
          <button className="button primary" onClick={onCreateProject}>
            Create a project
          </button>
        </li>
        <li>
          <h3>Track your time</h3>
          <p>
            Select a project, describe your work, and start the timer. Stop it
            to save, or use Log time for completed work.
          </p>
        </li>
        <li>
          <h3>Review and export</h3>
          <p>
            Open a project’s time to see its entries and totals. Use Reports for
            a weekly breakdown or export a CSV.
          </p>
        </li>
      </ol>
      <section className="install-guide" aria-label="Install Tempo">
        <h3>Add Tempo to your home screen</h3>
        <p>Open Tempo directly as an app. Use the same account and passkey.</p>
        <dl>
          <div>
            <dt>iPhone or iPad</dt>
            <dd>
              Open Tempo in Safari. Tap Share, then Add to Home Screen. Confirm
              with Add.
            </dd>
          </div>
          <div>
            <dt>Android</dt>
            <dd>
              Open Tempo in Chrome. Open the browser menu and choose Install app
              or Add to Home screen.
            </dd>
          </div>
          <div>
            <dt>Computer</dt>
            <dd>
              In Chrome or Edge, use the install icon in the address bar when
              available, then choose Install.
            </dd>
          </div>
        </dl>
        <p className="form-note">
          Already installed? Open Tempo from your home screen or applications.
          Saving time still requires an internet connection.
        </p>
      </section>
    </div>
  );
}
