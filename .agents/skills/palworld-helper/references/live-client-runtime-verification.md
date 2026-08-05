# Live client runtime verification

Use this procedure when a Palworld verification driver needs a real client connected to an isolated local server.

## Established owner workflow

The client can launch successfully without honoring `-connect=127.0.0.1:<port>`. In the current owner environment, the reliable workflow is:

1. Start the isolated server and evidence watcher.
2. Launch the Palworld client once in a visible user-interactive window without an automatic server-connect argument.
3. Tell the owner that the client is ready and provide the exact local server address, normally `127.0.0.1:8392` for the calculator drivers.
4. The owner manually joins that server and enters the loaded world.
5. Continue automatically when the evidence log shows a post-join observation marker.

Do not describe step 2 as a successful server connection. In this owner environment, omit `-connect` entirely: the owner deliberately joins the isolated server from the visible client after it opens.

The launcher process can also exit without leaving an active game client. After the startup grace period, check for a client process under the expected installation root. If none remains, keep the server and evidence watcher running and tell the owner to open Palworld manually from Steam. Do not report a transient launcher process as an active client, and do not try alternate direct executables or Steam command-line launches repeatedly while the watcher is active.

## Required state signals

Classify the session from evidence, not process state:

- `client launched`: the client process exists; connection is still unknown.
- `manual client startup pending`: the launcher returned but no game client remains; the owner must open Palworld from Steam while the watcher continues.
- `manual join pending`: no post-join handle, actor, parameter, or case marker has appeared.
- `world observed`: the driver has captured the domain-specific post-join marker, such as a valid initialized handle, actor, parameter profile, or runtime case.
- `complete`: the driver emitted its final completion marker and the verifier accepted the expected coverage with no error marker.

A responsive client window, high CPU use, elapsed time, server process health, or absence of a crash does not promote the session beyond `manual join pending`.

## Coordination rules

- Start the watcher before launching the client so early evidence is not lost.
- Launch the client visibly. Do not use a hidden-window option for an application the owner must see and control.
- Once the client is ready, send one concise owner handoff with the exact address and requested action. Do not claim the join is automatic, repeatedly relaunch the client, or ask the owner to perform unrelated setup.
- Keep the runner alive while the owner joins. Use a timeout that includes startup, manual action, and world loading; prefer at least 420 seconds for interactive sessions unless a longer observed baseline is documented.
- While waiting, keep progress updates concise and do not leave the owner without an update for more than 60 seconds.
- If the timeout expires before a post-join marker, report an incomplete/manual-join-pending session. Do not label it a formula failure, runtime contradiction, or successful empty observation.
- If a post-join marker appears but required cases or `complete` do not, report the exact driver/runtime error separately from connection state.

## Independent sessions and cleanup

- Each independent golden session requires a clean isolated-server start and a fresh client connection. The owner manually joins again for every session.
- Before cleanup, resolve exact process IDs and paths. Stop only the exact client process returned by the runner when it still has the expected executable path. Do not sweep the installation directory by process start time, and do not terminate a manually opened client, a child process whose ownership cannot be proven, unrelated Palworld processes, or Steam.
- Preserve reusable drivers and validators in the repository. Keep UE4SS logs, runtime case logs, reports containing machine state, installed server files, mod packages, local addresses beyond the documented loopback endpoint, and machine paths under ignored `private/` storage.
- Accept a session only after the domain verifier checks completeness, uniqueness, boundary coverage, numeric validity, and any required independent-session agreement.

## Runner behavior

A runner that offers a client-launch switch must:

- describe the launch as client startup, not server-join success;
- open a visible client without `-connect`, then print that the owner must manually join the exact address;
- retain only the exact returned client PID for optional cleanup and leave manually opened or unproven child processes alone;
- continue polling for evidence after launch;
- distinguish launch failure, manual-join timeout, post-join runtime error, and complete evidence;
- avoid marking connection or completion from process existence alone.
