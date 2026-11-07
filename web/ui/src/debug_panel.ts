import { t, label, setModalRenderer } from "./i18n";
import { GameState, MapMetadata } from "./types";
import { MAP_METADATA } from "./metadata";

export class DebugPanel {
  private mapData: MapMetadata = MAP_METADATA;
  constructor(private onOverride: (override: any) => string | null) {}
  public fetchMetadata() { this.mapData = MAP_METADATA; }
  public setMapData(data: MapMetadata) { this.mapData = data; }

  public openDebugModal(state: GameState) {
    const modal = document.getElementById('modal-container');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    if (!modal || !title || !body) return;
    const countries = this.mapData.countries;
    // Keep drafts when changing country or language; opening the inspector starts a fresh draft.
    const drafts = new Map<number, { us: number; ussr: number }>();
    const original = (id: number) => {
      const country = countries.find(c => c.id === id);
      const value = country ? state.countries?.[country.name] : undefined;
      return { us: value?.us_influence ?? 0, ussr: value?.ussr_influence ?? 0 };
    };
    const draw = () => {
      title.textContent = t('Engine Debug & State Inspector');
      body.innerHTML = `
        <form class="dbg-form" id="dbg-form">
          <section><h4>${t('Override Tracks')}</h4><div class="dbg-fields">
            <label>${t('DEFCON:')} <input required type="number" id="dbg-defcon" min="1" max="5" step="1" value="${state.defcon}"></label>
            <label>${t('Victory Points (-20 to +20):')} <input required type="number" id="dbg-vp" min="-20" max="20" step="1" value="${state.victory_points}"></label>
          </div></section>
          <section><h4>${t('Set Country Influence')}</h4><div class="dbg-fields">
            <select id="dbg-country-select">${countries.map(c => `<option value="${c.id}">${label(c.name)} (#${c.id})</option>`).join('')}</select>
            <label>${t('US:')} <input required type="number" id="dbg-us-inf" min="0" max="99" step="1"></label>
            <label>${t('USSR:')} <input required type="number" id="dbg-ussr-inf" min="0" max="99" step="1"></label>
          </div></section>
          <p id="dbg-error" role="alert" hidden></p>
          <footer class="dbg-footer"><button type="submit" id="dbg-apply-all" class="btn btn-primary">${t('Apply')}</button></footer>
        </form>`;
      const field = (id: string) => document.getElementById(id) as HTMLInputElement;
      const selected = () => Number(field('dbg-country-select').value);
      const loadCountry = () => {
        const value = drafts.get(selected()) ?? original(selected());
        field('dbg-us-inf').value = String(value.us);
        field('dbg-ussr-inf').value = String(value.ussr);
      };
      const saveCountry = () => drafts.set(selected(), {
        us: field('dbg-us-inf').valueAsNumber, ussr: field('dbg-ussr-inf').valueAsNumber,
      });
      loadCountry();
      field('dbg-country-select').addEventListener('change', loadCountry);
      field('dbg-us-inf').addEventListener('input', saveCountry);
      field('dbg-ussr-inf').addEventListener('input', saveCountry);
      document.getElementById('dbg-form')!.addEventListener('submit', event => {
        event.preventDefault();
        const defcon = field('dbg-defcon').valueAsNumber, vp = field('dbg-vp').valueAsNumber;
        const changes: any[] = [];
        for (const [id, value] of drafts) {
          const before = original(id);
          if (value.us === before.us && value.ussr === before.ussr) continue;
          // Drafts for other countries also need validation before any mutation occurs.
          if (![value.us, value.ussr].every(n => Number.isInteger(n) && n >= 0 && n <= 99)) {
            field('dbg-country-select').value = String(id); loadCountry();
            (document.getElementById('dbg-form') as HTMLFormElement).reportValidity(); return;
          }
          changes.push({ op: 'set_country', country_id: id, ...value });
        }
        if (defcon !== state.defcon) changes.push({ op: 'set_defcon', defcon });
        if (vp !== state.victory_points) changes.push({ op: 'set_vp', vp });
        const error = this.onOverride({ op: 'batch', changes });
        if (error) { const el = document.getElementById('dbg-error')!; el.hidden = false; el.textContent = error; }
        else modal.classList.add('hidden');
      });
    };
    setModalRenderer(draw);
    draw();
    modal.classList.remove('hidden');
  }
}
