/**
 * The PanelHost (web-blueprint.md §5.3, panels-blueprint §2, §5).
 *
 * Renders a panel from a `WirePanelDeclaration` the backend relays — a LOCAL
 * structural mirror of the core's `PanelDeclaration` (the browser never imports
 * `@voidrift/core`, §5.3). The declaration is pure data: a title, columns, the
 * dotted CoreAPI operation(s) its rows come from, and keyed hotkey actions. The
 * client fetched the rows over HTTP on open and passes them in as `rows`; the
 * declaration itself holds no rows and no getter (panels §2, §5). The table is
 * semantic and labeled for accessibility (§9).
 */
import type { WirePanelDeclaration } from "../events/wire.js";
import { sanitizeText } from "../workspace/sanitize-text.js";

export interface PanelHostProps {
  readonly name: string;
  readonly definition: WirePanelDeclaration;
  /** The row snapshot the client fetched for this panel's `source` op (§5). */
  readonly rows?: ReadonlyArray<Record<string, unknown>>;
  readonly onClose: () => void;
  readonly onAction?: (hotkey: string, item: unknown) => void;
}

export function PanelHost(props: PanelHostProps): React.JSX.Element {
  const { definition } = props;
  const rows = props.rows ?? [];
  const actionEntries = Object.entries(definition.actions ?? {});
  return (
    <section role="dialog" aria-label={definition.title} aria-modal="false">
      <header>
        <h2>{definition.title}</h2>
        <button type="button" onClick={props.onClose} aria-label="Close panel">
          Close
        </button>
      </header>
      <table>
        <caption>{definition.title}</caption>
        <thead>
          <tr>
            {definition.columns.map((c) => (
              <th key={c.key} scope="col">
                {c.label}
              </th>
            ))}
            {actionEntries.length > 0 ? <th scope="col">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {definition.columns.map((c) => (
                <td key={c.key} dir="auto">{sanitizeText(String((row as Record<string, unknown>)[c.key] ?? ""))}</td>
              ))}
              {actionEntries.length > 0 ? (
                <td>
                  {actionEntries.map(([hotkey, action]) => (
                    <button key={hotkey} type="button" onClick={() => props.onAction?.(hotkey, row)}>
                      {action.label} ({hotkey})
                    </button>
                  ))}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
