"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link"],
    ["clean"],
  ],
};

const QUILL_FORMATS = [
  "header", "bold", "italic", "underline", "strike",
  "list", "link",
];

// ---------------------------------------------------------------------------
// Field-level components
// ---------------------------------------------------------------------------

function TextField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
      />
    </div>
  );
}

function RichTextField({ label, value, onChange }) {
  const normalizedValue = value || "";
  const lastValueRef = useRef(normalizedValue);

  useEffect(() => {
    lastValueRef.current = normalizedValue;
  }, [normalizedValue]);

  function handleChange(nextValue) {
    if (nextValue === lastValueRef.current) {
      return;
    }

    lastValueRef.current = nextValue;
    onChange(nextValue);
  }

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
        {label}
      </label>
      <div className="rounded-lg overflow-hidden border border-slate-600 cms-quill-dark">
        <ReactQuill
          theme="snow"
          value={normalizedValue}
          onChange={handleChange}
          modules={QUILL_MODULES}
          formats={QUILL_FORMATS}
        />
      </div>
    </div>
  );
}

function StringListField({ label, items, onChange }) {
  function updateItem(idx, val) {
    const next = [...items];
    next[idx] = val;
    onChange(next);
  }
  function addItem() {
    onChange([...items, ""]);
  }
  function removeItem(idx) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
        {label}
      </label>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              type="text"
              value={item || ""}
              onChange={(e) => updateItem(idx, e.target.value)}
              className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => removeItem(idx)}
              className="rounded-lg border border-rose-700/50 bg-rose-900/30 px-2 py-1 text-xs text-rose-400 hover:bg-rose-800/50 transition-colors"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 transition-colors"
        >
          + Add item
        </button>
      </div>
    </div>
  );
}

function StatsField({ label, items, onChange }) {
  function updateItem(idx, field, val) {
    const next = items.map((item, i) => (i === idx ? { ...item, [field]: val } : item));
    onChange(next);
  }
  function addItem() {
    onChange([...items, { value: "", label: "" }]);
  }
  function removeItem(idx) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
        {label}
      </label>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="rounded-xl border border-slate-700 bg-slate-900/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Stat {idx + 1}</span>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="rounded border border-rose-700/50 bg-rose-900/20 px-2 py-0.5 text-xs text-rose-400 hover:bg-rose-900/50"
              >
                Remove
              </button>
            </div>
            <TextField label="Value" value={item.value} onChange={(v) => updateItem(idx, "value", v)} />
            <TextField label="Label" value={item.label} onChange={(v) => updateItem(idx, "label", v)} />
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 transition-colors"
        >
          + Add stat
        </button>
      </div>
    </div>
  );
}

function FeaturesField({ label, items, onChange }) {
  function updateItem(idx, field, val) {
    const next = items.map((item, i) =>
      i === idx ? { ...item, [field]: val } : item
    );
    onChange(next);
  }
  function addItem() {
    onChange([...items, { title: "", description: "" }]);
  }
  function removeItem(idx) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
        {label}
      </label>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="rounded-xl border border-slate-700 bg-slate-900/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Item {idx + 1}</span>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="rounded border border-rose-700/50 bg-rose-900/20 px-2 py-0.5 text-xs text-rose-400 hover:bg-rose-900/50"
              >
                Remove
              </button>
            </div>
            <TextField
              label="Eyebrow"
              value={item.eyebrow}
              onChange={(v) => updateItem(idx, "eyebrow", v)}
            />
            <TextField
              label="Title"
              value={item.title}
              onChange={(v) => updateItem(idx, "title", v)}
            />
            <RichTextField
              label="Description"
              value={item.description}
              onChange={(v) => updateItem(idx, "description", v)}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 transition-colors"
        >
          + Add feature
        </button>
      </div>
    </div>
  );
}

function SecurityItemsField({ label, items, onChange }) {
  function updateItem(idx, field, val) {
    const next = items.map((item, i) => (i === idx ? { ...item, [field]: val } : item));
    onChange(next);
  }
  function addItem() {
    onChange([...items, { title: "", description: "" }]);
  }
  function removeItem(idx) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
        {label}
      </label>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="rounded-xl border border-slate-700 bg-slate-900/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Item {idx + 1}</span>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="rounded border border-rose-700/50 bg-rose-900/20 px-2 py-0.5 text-xs text-rose-400 hover:bg-rose-900/50"
              >
                Remove
              </button>
            </div>
            <TextField label="Title" value={item.title} onChange={(v) => updateItem(idx, "title", v)} />
            <RichTextField label="Description" value={item.description} onChange={(v) => updateItem(idx, "description", v)} />
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 transition-colors"
        >
          + Add security item
        </button>
      </div>
    </div>
  );
}

function SectionsField({ label, items, onChange }) {
  function updateItem(idx, field, val) {
    const next = items.map((item, i) =>
      i === idx ? { ...item, [field]: val } : item
    );
    onChange(next);
  }
  function addItem() {
    onChange([...items, { title: "", body: "" }]);
  }
  function removeItem(idx) {
    onChange(items.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
        {label}
      </label>
      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={idx} className="rounded-xl border border-slate-700 bg-slate-900/50 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Section {idx + 1}</span>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="rounded border border-rose-700/50 bg-rose-900/20 px-2 py-0.5 text-xs text-rose-400 hover:bg-rose-900/50"
              >
                Remove
              </button>
            </div>
            <TextField
              label="Section title"
              value={item.title}
              onChange={(v) => updateItem(idx, "title", v)}
            />
            <RichTextField
              label="Body"
              value={item.body}
              onChange={(v) => updateItem(idx, "body", v)}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={addItem}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 transition-colors"
        >
          + Add section
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-page structured editors
// ---------------------------------------------------------------------------

function HomeEditor({ content, onChange }) {
  function set(field, value) {
    onChange({ ...content, [field]: value });
  }

  return (
    <div className="space-y-5">
      <TextField label="Hero badge" value={content.heroBadge} onChange={(v) => set("heroBadge", v)} />
      <TextField label="Hero title" value={content.heroTitle} onChange={(v) => set("heroTitle", v)} />
      <RichTextField label="Hero description" value={content.heroDescription} onChange={(v) => set("heroDescription", v)} />
      <TextField label="CTA primary button" value={content.ctaPrimary} onChange={(v) => set("ctaPrimary", v)} />
      <TextField label="CTA secondary button" value={content.ctaSecondary} onChange={(v) => set("ctaSecondary", v)} />
      <StatsField
        label="Hero stats"
        items={Array.isArray(content.heroStats) ? content.heroStats : []}
        onChange={(v) => set("heroStats", v)}
      />
      <TextField label="Highlight panel title" value={content.highlightTitle} onChange={(v) => set("highlightTitle", v)} />
      <StringListField
        label="Highlight panel items"
        items={Array.isArray(content.highlightItems) ? content.highlightItems : []}
        onChange={(v) => set("highlightItems", v)}
      />
      <TextField label="Features eyebrow" value={content.featuresEyebrow} onChange={(v) => set("featuresEyebrow", v)} />
      <TextField label="Features section title" value={content.featuresTitle} onChange={(v) => set("featuresTitle", v)} />
      <FeaturesField
        label="Features"
        items={Array.isArray(content.features) ? content.features : []}
        onChange={(v) => set("features", v)}
      />
      <TextField label="How it works eyebrow" value={content.howItWorksEyebrow} onChange={(v) => set("howItWorksEyebrow", v)} />
      <TextField label="How it works title" value={content.howItWorksTitle} onChange={(v) => set("howItWorksTitle", v)} />
      <StringListField
        label="How it works steps"
        items={Array.isArray(content.howItWorksSteps) ? content.howItWorksSteps : []}
        onChange={(v) => set("howItWorksSteps", v)}
      />
      <TextField label="Why choose eyebrow" value={content.whyChooseEyebrow} onChange={(v) => set("whyChooseEyebrow", v)} />
      <TextField label="Why choose title" value={content.whyChooseTitle} onChange={(v) => set("whyChooseTitle", v)} />
      <StringListField
        label="Why choose items"
        items={Array.isArray(content.whyChooseItems) ? content.whyChooseItems : []}
        onChange={(v) => set("whyChooseItems", v)}
      />
      <TextField label="Trust section eyebrow" value={content.securityEyebrow} onChange={(v) => set("securityEyebrow", v)} />
      <TextField label="Trust section title" value={content.securityTitle} onChange={(v) => set("securityTitle", v)} />
      <SecurityItemsField
        label="Trust & security items"
        items={Array.isArray(content.securityItems) ? content.securityItems : []}
        onChange={(v) => set("securityItems", v)}
      />
      <TextField label="Final CTA title" value={content.finalCtaTitle} onChange={(v) => set("finalCtaTitle", v)} />
    </div>
  );
}

function ContactEditor({ content, onChange }) {
  function set(field, value) {
    onChange({ ...content, [field]: value });
  }

  return (
    <div className="space-y-5">
      <TextField label="Heading" value={content.heading} onChange={(v) => set("heading", v)} />
      <RichTextField label="Description" value={content.description} onChange={(v) => set("description", v)} />
      <StringListField
        label="Contact items"
        items={Array.isArray(content.contactItems) ? content.contactItems : []}
        onChange={(v) => set("contactItems", v)}
      />
      <TextField label="Form title" value={content.formTitle} onChange={(v) => set("formTitle", v)} />
      <TextField label="Success title" value={content.successTitle} onChange={(v) => set("successTitle", v)} />
      <TextField label="Success description" value={content.successDescription} onChange={(v) => set("successDescription", v)} />
    </div>
  );
}

function PrivacyEditor({ content, onChange }) {
  function set(field, value) {
    onChange({ ...content, [field]: value });
  }

  return (
    <div className="space-y-5">
      <TextField label="Heading" value={content.heading} onChange={(v) => set("heading", v)} />
      <TextField label="Effective date" value={content.effectiveDate} onChange={(v) => set("effectiveDate", v)} />
      <SectionsField
        label="Policy sections"
        items={Array.isArray(content.sections) ? content.sections : []}
        onChange={(v) => set("sections", v)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main exported component
// ---------------------------------------------------------------------------

/**
 * CmsEditor renders a structured form for editing a CMS page.
 *
 * Props:
 *   pageKey  – "home" | "contact-us" | "privacy-policy"
 *   content  – current content object
 *   onChange – (nextContent) => void
 */
export default function CmsEditor({ pageKey, content = {}, onChange }) {
  if (pageKey === "home") {
    return <HomeEditor content={content} onChange={onChange} />;
  }
  if (pageKey === "contact-us") {
    return <ContactEditor content={content} onChange={onChange} />;
  }
  if (pageKey === "privacy-policy") {
    return <PrivacyEditor content={content} onChange={onChange} />;
  }
  return (
    <p className="text-sm text-slate-400">No structured editor for this page key.</p>
  );
}
