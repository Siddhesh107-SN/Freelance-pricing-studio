import { Field, Segmented } from '../common/ui.jsx';
import { COMPLEXITY_LABEL } from '../../utils/formatting.js';
import { typesFor } from '../../utils/validation.js';

const COMPLEXITY_NOTE = {
  basic: 'Simple scope. Base prices and hours.',
  intermediate: 'Custom design or several integrations. Mid-tier prices, about 1.5x hours.',
  advanced: 'Complex logic, roles or heavy integrations. Top-tier prices, about 2x hours.',
};

export default function ProjectStep({ est, categories, errors }) {
  const { state, patch, setCategory } = est;
  const p = state.project;
  const cat = categories.find((c) => c.id === p.category_id);
  const types = typesFor(cat?.name);
  const input = (key, label, props = {}) => (
    <Field label={label} error={errors[key]}>
      <input value={p[key]} onChange={(e) => patch('project', { [key]: e.target.value })} aria-label={label} {...props} />
    </Field>
  );
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">What are we building?</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {input('project_name', 'Project name')}
        {input('client_name', 'Client name')}
        {input('company', 'Company name')}
        {input('email', 'Email address', { type: 'email' })}
        {input('phone', 'Phone number', { type: 'tel' })}
      </div>
      <Field label="Project description">
        <textarea rows={3} value={p.project_description} onChange={(e) => patch('project', { project_description: e.target.value })} aria-label="Project description" />
      </Field>

      <div>
        <p className="mb-2 text-sm font-medium">Project category</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <button key={c.id} type="button" aria-pressed={p.category_id === c.id} onClick={() => setCategory(c.id)}
              className={`rounded-2xl border p-4 text-left transition ${p.category_id === c.id ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink'}`}>
              <span className="block font-medium">{c.name}</span>
              <span className={`mt-1 block text-xs ${p.category_id === c.id ? 'text-gray-300' : 'text-gray-500'}`}>{c.description}</span>
            </button>
          ))}
        </div>
        {errors.category_id && <p role="alert" className="mt-1 text-xs text-red-600">{errors.category_id}</p>}
      </div>

      {cat && (
        <div>
          <p className="mb-2 text-sm font-medium">Project type</p>
          {types.length ? (
            <div className="flex flex-wrap gap-2">
              {types.map((t) => (
                <button key={t} type="button" aria-pressed={p.project_type === t} onClick={() => patch('project', { project_type: t })}
                  className={`rounded-full border px-3 py-1.5 text-sm ${p.project_type === t ? 'border-accent bg-accent-soft text-accent-dark' : 'border-line bg-white hover:border-ink'}`}>{t}</button>
              ))}
            </div>
          ) : (
            <input aria-label="Project type" value={p.project_type} onChange={(e) => patch('project', { project_type: e.target.value })} placeholder="Describe the project type" />
          )}
          {errors.project_type && <p role="alert" className="mt-1 text-xs text-red-600">{errors.project_type}</p>}
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium">Complexity</p>
        <Segmented label="Complexity" value={p.complexity} onChange={(v) => patch('project', { complexity: v })}
          options={Object.keys(COMPLEXITY_LABEL).map((v) => ({ value: v, label: COMPLEXITY_LABEL[v] }))} />
        <p className="mt-2 text-sm text-gray-500">{COMPLEXITY_NOTE[p.complexity]}</p>
      </div>
    </div>
  );
}
