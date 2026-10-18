# What the MCP endpoint lacks to lead agentic code-CAD

*2026-10-18. The question: what is missing for this endpoint ([MCP.md](MCP.md)) to be the best
code-CAD tool for AI agents? Four research passes covered code-CAD MCP servers and harnesses,
commercial CAD vendors' agent access, papers and benchmarks on CAD agents, and MCP distribution and
in-chat UI. Their sources are linked inline.*

*Most figures are as published, not re-measured. The CADGenBench rules and Claude's support for
interactive connectors were checked by hand. The paired-delta figures in §1 were the research
agent's own computation from the official results file. One third-party mirror (BenchLM) reports
different leaderboard numbers; the official file is used throughout.*

## Summary

The harness already offers more verification than any other hosted build123d server. What it lacks:
- **Proof:** a public benchmark score.
- **Checks against the person's requirements:** a ledger of stated values that is re-checked on
  every run.
- **Assemblies and manufacturing drawings.**
- **An in-chat experience:** a 3-D viewer the person can rotate, select in and download from.

## Where we already lead

- **No install, any client.** It works from claude.ai and the iOS app with nothing installed, and
  every run is sandboxed. Most bridges need a licensed desktop CAD app (often Windows-only) or a
  local Python install, and can't be reached from claude.ai at all
  ([BuildCAD guide](https://buildcad.ai/guides/cad-mcp-servers),
  [TechDraw AI](https://techdrawai.com/blog/cad-mcp-servers)).
- **Deeper hosted verification:** the validity gate, `compare`, `design_audit`, the feature finders
  and printability checks. The only other hosted build123d servers are BuildCAD (5 tools) and
  kernelCAD (paid, [$19–39/month](https://kernelcad.com/)).
- **A shared live editor.** The person can open and edit the session the agent is working in.
  Elsewhere viewers are watch-only (for example pzfreo's
  [live viewer](https://github.com/pzfreo/build123d-mcp/blob/main/docs/live-viewer.md)).

## The gaps, ranked

### 1. Proof of quality: a benchmark score

[CADGenBench](https://github.com/huggingface/cadgenbench) (Hugging Face) is now the public yardstick.

**How it works:**
- **Tasks:** 49 generation tasks (engineering drawing → STEP) and 32 editing tasks (apply a change
  to a STEP file).
- **Validity gate:** a closed, orientable, manifold solid, checked first.
- **Generation score** ([metrics](https://github.com/huggingface/cadgenbench/blob/main/docs/metrics.md)):
  0.4 shape (surface F1 plus volume IoU) + 0.4 interfaces (keep-in/keep-out regions) + 0.2 topology
  (Betti numbers).
- **Scoring:** server-side against private ground truth. Entries publish as unvalidated until the
  maintainers promote them.

**Standings** ([official results](https://huggingface.co/datasets/HuggingAI4Engineering/cadgenbench-submissions)):
- deeprd-v2: 0.848, unvalidated.
- pzfreo's build123d-mcp with Opus 5.5 at max effort: 0.830, validated.
- Godela: 0.811, validated.

**Where harness gains come from.** With the same model (Opus 5.5, xhigh effort), the official
baseline prompt scored 0.752 and build123d-mcp 0.805.
- Of that +0.053, +0.050 came from the 6 fixtures where the baseline's output was invalid.
- On the 75 fixtures both runs got valid, the harness added +0.003.
- So today's tools buy validity, editing reliability and lower cost, not accuracy at reading
  drawings ([author's write-up](https://experimentsin3d.substack.com/p/i-asked-claude-what-would-help-it)).

**What we need:**
- An eval runner.
- A matched no-MCP baseline (same model, same effort).
- At least two scored runs with per-fixture paired analysis, the server version pinned.
- A mirror of the official validity gate and the 50 MB STEP cap.

Our STEP export is real (`scripts/mcp-test.mjs` checks the ISO-10303-21 header). Full runs cost
pzfreo about $600–800 each, so a run needs a decision on spend.

[CADTestBench](https://github.com/dimitrismallis/CADTestBench) is public and reference-free, so it
suits quick development iterations.

### 2. The person's spec as executable tests

**The idea.** The agent records the stated requirements ("bore Ø8 H7", "4 holes on a 40 mm bolt
circle", "wall ≥ 2 mm"), and every `execute` reports pass/fail against them.

**The evidence** is the strongest of anything found:
- **[CADTests](https://arxiv.org/html/2605.07807v1):**
  - Tests agreed with human judges 93.8% of the time, against 47.4% for a vision-model judge.
  - Tests plus logs of intermediate geometry was the best configuration.
  - Multi-view renders added nothing.
  - A skill document alone did nothing either: 0.505, against 0.510 for plain examples.
- **[Seek-CAD](https://arxiv.org/html/2505.17702v3), [Query2CAD](https://arxiv.org/abs/2406.00144)
  and [IterCAD](https://arxiv.org/html/2608.24020):** visual self-critique helps for one or two
  rounds, then stalls or hurts.
- **[CADSmith](https://arxiv.org/html/2603.26512v1):** vision catches gross errors, not dimensions.

**Who has it:**
- pzfreo: `verify_spec` and a target ledger.
- [agentcad](https://github.com/jdilla1277/agentcad): `check-spec`.
- [cad-khana](https://github.com/cyberchitta/cad-khana): declared claims.
- [kernelCAD](https://kernelcad.com/docs/mcp-tools): an assumption ledger.

We have the parts: probe runs, `measure`, the feature finders and per-session storage.

### 3. Comparison against a reference

No harness has shown a gain on drawing reading yet, so this is the clearest opening.
- **Against a reference STEP or mesh:** CADGenBench's own metrics — alignment over 24 orientations
  plus ICP, surface F1, volume IoU, and Betti numbers (counts of separate pieces, through-holes and
  enclosed voids).
- **For edits:** a preservation diff against the input ([TraceCAD](https://arxiv.org/abs/2608.03062)).
- **Against a drawing:**
  - Project the model into the drawing's views with the exact hidden-line projection
    (`project_to_viewport`).
  - Score the outline overlap per view.
  - Keep a ledger of the dimension callouts.

Precedents:
- [jarvis-onshape](https://github.com/ReshefElisha/jarvis-onshape-mcp): `compare_to_reference`.
- kernelCAD: `drawing_to_cad` and `trace_from_image`.
- [CADCodeVerify](https://arxiv.org/html/2410.05340v2): feedback from ground truth beat VLM
  self-checks.

### 4. Validators that don't pass bad geometry

Other validators were caught passing bad geometry:
- a 0.00001 mm slab ([pzfreo issues](https://github.com/pzfreo/build123d-mcp/issues));
- two disconnected pieces reported as a "clean manifold solid"
  ([XDA](https://www.xda-developers.com/asked-claude-gpt-design-3d-prints-failed-opposite-ways/));
- non-manifold meshes reported as "NoError" ([ModelRift](https://modelrift.com/blog/cadquery-vs-openscad/)).

The fix is to audit `validate` against these cases and add a count of separate pieces, a
minimum-thickness check and a Betti-number check. This is cheap.

### 5. Assemblies

"No assemblies" is the most common criticism of AI CAD everywhere
([HN](https://news.ycombinator.com/item?id=47970497),
[CoLab](https://www.colabsoftware.com/post/autodesk-fusion-mcp-faster-cad-same-bottleneck)).

What competitors offer:
- **Mates and solved positions:** kernelCAD (`add_mate`, `solve_mates`),
  [SolidWorks-MCP](https://github.com/hjbaard/SolidWorks-MCP) (six mate types, `check_motion`),
  [blwfish freecad-mcp](https://github.com/blwfish/freecad-mcp) (joint solving), and Fusion Compute
  (components, occurrences, joints).
- **Motion and collision sweeps:** kernelCAD.
- **STEP that keeps assembly structure:** [Casys mcp-build123d](https://github.com/Casys-AI/mcp-build123d)
  reports XCAF occurrences, contacts and intersection volumes.

Lite already has joints. What's missing is the assembly layer: part identities, STEP structure,
names and colours. That is on the roadmap and is large; it likely needs fork bindings.

### 6. Manufacturing drawings

No MCP server yet produces a toleranced, dimensioned drawing sheet
([TechDraw AI](https://techdrawai.com/blog/cad-mcp-servers)). We already have exact hidden-line
projection, dimension lines and a title block.

**What's missing:**
- automatic dimensions and hole callouts;
- tolerances and GD&T;
- a PDF sheet;
- later, tolerances embedded in the STEP (PMI in AP242).

This is the most winnable gap. [pzfreo/draftwright](https://github.com/pzfreo/draftwright) already
does all of it. Its Rust port publishes a wasm package that reads STEP with no OpenCascade.
- **Measured:** it ran in workerd, drawing a session's STEP in 0.6–1.5 s with 11–23 MB for
  typical parts. Dense 200+-face parts need 66–540 MB, more than a Worker isolate has.
- **Open:** licensing (AGPL) and the author's own hosted service need a decision first.

Details are in [DRAFTWRIGHT-WASM.md](DRAFTWRIGHT-WASM.md).

### 7. Real purchasable parts

[text-to-cad](https://github.com/earthtojake/text-to-cad) uses [step.parts](https://www.step.parts),
a hosted catalogue of vendor STEP models (servos, motors, boards, fasteners). kernelCAD has
`find_part`/`fetch_part`.

`import_cad_file` already imports from a URL, so a search tool over the step.parts API would close
most of the gap. Their terms need checking first. Our built-in ISO library (13 parts) is thin.

### 8. An inline 3-D viewer (MCP Apps)

**The standard.** [MCP Apps](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx)
became a stable extension on 2026-01-26.
- **Where it renders:**
  - Claude says interactive connectors work for all users on web, desktop and iOS/Android
    ([support article](https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude)).
  - ChatGPT, VS Code and Cursor render them too.
  - Claude Code does not.
- **Examples:** the official set includes a
  [three.js example](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/threejs-server).
- **CAD viewers:** none found for B-rep CAD yet.
  [Casys](https://github.com/Casys-AI/mcp-onshape) and [Tau](https://github.com/taucad/tau/pull/471)
  ship mesh viewers.

**It would solve three things at once:**
- The model can be rotated in the chat, on a phone.
- A download button sidesteps the sandbox-egress 403 (see MCP.md, *Links, not uploads*).
- Clicking a face can tell the agent "this face" through `ui/update-model-context`. People ask for
  exactly that: "In 3D CAD, you click on it" ([HN](https://news.ycombinator.com/item?id=48572553)).
  Others with an agent-readable selection: text-to-cad, kernelCAD `get_selection`, Zoo
  `select_entities`, blwfish `continue_selection`.

**Constraints** ([troubleshooting](https://claude.com/docs/connectors/building/mcp-apps/troubleshooting)):
- **Network:** blocked by default. Our origin goes in `_meta.ui.csp.connectDomains`.
- **CORS:** must allow on `Origin` `*.claudemcpcontent.com`, because iOS WebKit sends no Referer.
- **Large results:** a tool result over ~150k characters is diverted to the sandbox, so the app
  must fetch the GLB itself rather than receive it in the result.
- **Unverified:** the support page names only directory connectors with an "Interactive" badge.
  Whether a custom connector renders an App needs a small prototype on a phone.

### 9. Real build123d in MCP sessions

The session Worker already takes a flavor (`'lite' | 'upstream'`, `src/session.js`). Both
high-fidelity flavors run on Workers ([FIDELITY-ON-WORKERS.md](FIDELITY-ON-WORKERS.md)):
- **upstream:** build123d 0.13's own Python on MicroPython, 232 of 239 corpus scripts passing;
- **real:** the PyPI wheel on Pyodide, also 232;
- **lite:** 224 for comparison.

Offering one through the MCP would:
- answer the "it's a port" objection;
- help benchmark accuracy;
- unlock the quiddity feature-recognition tools.

Drawings don't depend on this: draftwright's wasm package reads STEP from any flavor (§6).

### 10. Later, and harder

- **A sketch constraint solver** that reports the remaining degrees of freedom:
  - [Zoo](https://zoo.dev/blog/whats-new-mar-2026): constraint status;
  - kernelCAD: `solve_sketch`;
  - [CAiD](https://glama.ai/mcp/servers/dreliq9/caid-mcp): PlaneGCS.

  Agents otherwise delete constraints to quiet the solver
  ([TechDraw AI](https://techdrawai.com/blog/connect-claude-to-freecad)).
- **FEA with a visible setup.** Trust is low: only 17% of surveyed decision-makers trust
  AI-generated simulation inputs ([survey](https://iot-analytics.com/the-ai-trust-gap-in-design-and-engineering-software/)),
  and one FreeCAD MCP issue reports a force silently off by 1000×.
- **Mesh or STEP → an editable script:**
  [Backflip](https://www.engineering.com/backflips-back-is-the-mesh-to-cad-ai-real-this-time/),
  kernelCAD `mesh_to_features`.
- **CNC and sheet-metal DFM, and quoting.** [Fabworks](https://www.fabworks.com/mcp) prices
  STEP files over MCP. text-to-cad has DFM findings that cite measured evidence.

## Distribution

These are a few days each.
- **Anthropic directory** ([review criteria](https://claude.com/docs/connectors/building/review-criteria)):
  - a `title` and a read-only or destructive hint on every tool;
  - actionable errors;
  - a privacy policy, terms, an icon, a docs page and a test account;
  - for Apps, 3–5 screenshots.
- **OAuth** ([auth](https://claude.com/docs/connectors/building/authentication)):
  - CIMD (client metadata documents);
  - refresh-token rotation, with `invalid_grant` for dead tokens;
  - loopback redirects on any port;
  - [lazy auth](https://claude.com/docs/connectors/building/lazy-authentication), so the free tools
    work before sign-in.
- **Results:** `structuredContent` plus `outputSchema`, repeating the key facts in the text (Claude
  Code and VS Code drop one of the two). Job handles for runs near claude.ai's 240 s limit.
- **Listings:** the official [MCP Registry](https://modelcontextprotocol.io/registry/remote-servers)
  (`server.json`), Glama and Smithery.
- **A plugin:** the skill plus the remote `.mcp.json`, for the Anthropic and OpenAI directories.
- **The 2026-07-28 spec** is stateless ([changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)),
  which fits our design. Cloudflare's Agents SDK v0.20 supports it.

**Keep the tool surface small.** Codex skipped a lazily loaded MCP server entirely
([pzfreo issues](https://github.com/pzfreo/build123d-mcp/issues)), and Glama rates a server by its
weakest tool description. New capabilities should mostly extend existing tools rather than grow 32
tools toward kernelCAD's 63.

## Suggested order

1. **Prove it.** An eval runner, the validator audit (§4), and a first CADGenBench run on lite and
   on real build123d. This sets the baseline every later change is judged against.
2. **The requirements ledger and reference comparison** (§2, §3): the best-evidenced wins, aimed at
   the leaderboard.
3. **The MCP Apps viewer** (§8), then directory submission.
4. **Assemblies with STEP structure, drawing sheets ([DRAFTWRIGHT-WASM.md](DRAFTWRIGHT-WASM.md)) and
   step.parts.**

Steps 1–2 are mostly server work that can be tested locally, apart from the benchmark spend. Step 3
needs a phone for the custom-connector check.
