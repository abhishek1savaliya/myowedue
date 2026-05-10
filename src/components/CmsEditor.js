"use client";

import dynamic from "next/dynamic";
import { createContext, useContext, useEffect, useRef } from "react";
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

const CMS_UI = {
  dark: {
    label: "block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1",
    input:
      "w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none",
    textarea:
      "w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none min-h-[5.5rem] resize-y",
    quillWrap: "rounded-lg overflow-hidden border border-slate-600 cms-quill-dark",
    itemCard: "rounded-xl border border-slate-700 bg-slate-900/50 p-3 space-y-2",
    itemCardHeader: "text-xs text-slate-500",
    btnSecondary:
      "rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 transition-colors",
    btnDanger:
      "rounded-lg border border-rose-700/50 bg-rose-900/30 px-2 py-1 text-xs text-rose-400 hover:bg-rose-800/50 transition-colors",
    planShell: "rounded-2xl border border-slate-700 bg-slate-900/40 p-4 space-y-4",
    planTitle: "text-sm font-semibold text-white",
    sectionWrap: "rounded-2xl border border-slate-700/80 bg-slate-900/30 p-4 sm:p-5",
    sectionTitle: "text-sm font-semibold text-cyan-200/90 border-b border-slate-700/60 pb-2",
    inlineCode:
      "rounded px-1 py-0.5 font-mono text-[11px] border border-slate-600/60 bg-slate-950/50 text-slate-300",
  },
  light: {
    label: "block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1",
    input:
      "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500 focus:outline-none",
    textarea:
      "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-amber-500 focus:outline-none min-h-[5.5rem] resize-y",
    quillWrap: "rounded-lg overflow-hidden border border-zinc-300 bg-white cms-quill-light",
    itemCard: "rounded-xl border border-zinc-200 bg-zinc-50/90 p-3 space-y-2 shadow-sm",
    itemCardHeader: "text-xs text-zinc-500",
    btnSecondary:
      "rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors",
    btnDanger:
      "rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100 transition-colors",
    planShell: "rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 space-y-4 shadow-sm",
    planTitle: "text-sm font-semibold text-zinc-900",
    sectionWrap: "rounded-2xl border border-zinc-200 bg-zinc-50/50 p-4 sm:p-5 shadow-sm",
    sectionTitle: "text-sm font-semibold text-zinc-800 border-b border-zinc-200 pb-2",
    inlineCode:
      "rounded px-1 py-0.5 font-mono text-[11px] border border-zinc-300 bg-zinc-100 text-zinc-800",
  },
};

const CmsEditorUiContext = createContext(CMS_UI.dark);

function useCmsUi() {
  return useContext(CmsEditorUiContext);
}

function EditorSection({ title, children }) {
  const ui = useCmsUi();
  return (
    <section className={ui.sectionWrap}>
      <h3 className={ui.sectionTitle}>{title}</h3>
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Field-level components
// ---------------------------------------------------------------------------

function TextField({ label, value, onChange }) {
  const ui = useCmsUi();
  return (
    <div>
      <label className={ui.label}>{label}</label>
      <input
        type="text"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className={ui.input}
      />
    </div>
  );
}

function TextAreaField({ label, value, onChange, rows = 4 }) {
  const ui = useCmsUi();
  return (
    <div>
      <label className={ui.label}>{label}</label>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={ui.textarea}
      />
    </div>
  );
}

function RichTextField({ label, value, onChange }) {
  const ui = useCmsUi();
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
      <label className={ui.label}>{label}</label>
      <div className={ui.quillWrap}>
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
  const ui = useCmsUi();
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
      <label className={ui.label}>{label}</label>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              type="text"
              value={item || ""}
              onChange={(e) => updateItem(idx, e.target.value)}
              className={`flex-1 ${ui.input}`}
            />
            <button type="button" onClick={() => removeItem(idx)} className={ui.btnDanger}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={addItem} className={ui.btnSecondary}>
          + Add item
        </button>
      </div>
    </div>
  );
}

function StatsField({ label, items, onChange }) {
  const ui = useCmsUi();
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
      <label className={`${ui.label} mb-2 block`}>{label}</label>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className={`${ui.itemCard} space-y-2`}>
            <div className="flex items-center justify-between">
              <span className={ui.itemCardHeader}>Stat {idx + 1}</span>
              <button type="button" onClick={() => removeItem(idx)} className={ui.btnDanger}>
                Remove
              </button>
            </div>
            <TextField label="Value" value={item.value} onChange={(v) => updateItem(idx, "value", v)} />
            <TextField label="Label" value={item.label} onChange={(v) => updateItem(idx, "label", v)} />
          </div>
        ))}
        <button type="button" onClick={addItem} className={ui.btnSecondary}>
          + Add stat
        </button>
      </div>
    </div>
  );
}

function FeaturesField({ label, items, onChange }) {
  const ui = useCmsUi();
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
      <label className={`${ui.label} mb-2 block`}>{label}</label>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className={`${ui.itemCard} space-y-2`}>
            <div className="flex items-center justify-between">
              <span className={ui.itemCardHeader}>Item {idx + 1}</span>
              <button type="button" onClick={() => removeItem(idx)} className={ui.btnDanger}>
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
        <button type="button" onClick={addItem} className={ui.btnSecondary}>
          + Add feature
        </button>
      </div>
    </div>
  );
}

function PlanField({ label, value, onChange }) {
  const ui = useCmsUi();
  const plan = value && typeof value === "object" ? value : {};

  function set(field, nextValue) {
    onChange({ ...plan, [field]: nextValue });
  }

  return (
    <div className={ui.planShell}>
      <h3 className={ui.planTitle}>{label}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Badge" value={plan.badge} onChange={(v) => set("badge", v)} />
        <TextField label="Plan name" value={plan.name} onChange={(v) => set("name", v)} />
        <TextField label="Price" value={plan.price} onChange={(v) => set("price", v)} />
        <TextField label="Billing label" value={plan.billing} onChange={(v) => set("billing", v)} />
        <TextField label="CTA label" value={plan.ctaLabel} onChange={(v) => set("ctaLabel", v)} />
        <TextField label="CTA link" value={plan.ctaHref} onChange={(v) => set("ctaHref", v)} />
      </div>
      <RichTextField label="Description" value={plan.description} onChange={(v) => set("description", v)} />
      <StringListField
        label="Feature list"
        items={Array.isArray(plan.features) ? plan.features : []}
        onChange={(v) => set("features", v)}
      />
    </div>
  );
}

function SecurityItemsField({ label, items, onChange }) {
  const ui = useCmsUi();
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
      <label className={`${ui.label} mb-2 block`}>{label}</label>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className={`${ui.itemCard} space-y-2`}>
            <div className="flex items-center justify-between">
              <span className={ui.itemCardHeader}>Item {idx + 1}</span>
              <button type="button" onClick={() => removeItem(idx)} className={ui.btnDanger}>
                Remove
              </button>
            </div>
            <TextField label="Title" value={item.title} onChange={(v) => updateItem(idx, "title", v)} />
            <RichTextField label="Description" value={item.description} onChange={(v) => updateItem(idx, "description", v)} />
          </div>
        ))}
        <button type="button" onClick={addItem} className={ui.btnSecondary}>
          + Add security item
        </button>
      </div>
    </div>
  );
}

function SectionsField({ label, items, onChange }) {
  const ui = useCmsUi();
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
      <label className={`${ui.label} mb-2 block`}>{label}</label>
      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={idx} className={`${ui.itemCard} space-y-3`}>
            <div className="flex items-center justify-between">
              <span className={ui.itemCardHeader}>Section {idx + 1}</span>
              <button type="button" onClick={() => removeItem(idx)} className={ui.btnDanger}>
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
        <button type="button" onClick={addItem} className={ui.btnSecondary}>
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
  const ui = useCmsUi();
  function set(field, value) {
    onChange({ ...content, [field]: value });
  }

  return (
    <div className="space-y-6">
      <EditorSection title="Hero & highlights">
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
        <p className={`text-xs ${ui.itemCardHeader}`}>
          Shown on the public home page <code className={ui.inlineCode}>/</code> for visitors who are not logged in.
        </p>
      </EditorSection>

      <EditorSection title="Features">
        <TextField label="Features eyebrow" value={content.featuresEyebrow} onChange={(v) => set("featuresEyebrow", v)} />
        <TextField label="Features section title" value={content.featuresTitle} onChange={(v) => set("featuresTitle", v)} />
        <FeaturesField
          label="Feature cards"
          items={Array.isArray(content.features) ? content.features : []}
          onChange={(v) => set("features", v)}
        />
      </EditorSection>

      <EditorSection title="How it works & why choose us">
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
      </EditorSection>

      <EditorSection title="Trust & security">
        <TextField label="Trust section eyebrow" value={content.securityEyebrow} onChange={(v) => set("securityEyebrow", v)} />
        <TextField label="Trust section title" value={content.securityTitle} onChange={(v) => set("securityTitle", v)} />
        <SecurityItemsField
          label="Trust & security items"
          items={Array.isArray(content.securityItems) ? content.securityItems : []}
          onChange={(v) => set("securityItems", v)}
        />
      </EditorSection>

      <EditorSection title="Pricing">
        <TextField label="Plans eyebrow" value={content.plansEyebrow} onChange={(v) => set("plansEyebrow", v)} />
        <TextField label="Plans title" value={content.plansTitle} onChange={(v) => set("plansTitle", v)} />
        <RichTextField label="Plans description" value={content.plansDescription} onChange={(v) => set("plansDescription", v)} />
        <PlanField label="Free plan" value={content.freePlan} onChange={(v) => set("freePlan", v)} />
        <PlanField label="Paid plan" value={content.paidPlan} onChange={(v) => set("paidPlan", v)} />
        <TextField label="Plans footnote" value={content.plansFootnote} onChange={(v) => set("plansFootnote", v)} />
      </EditorSection>

      <EditorSection title="Final call-to-action">
        <TextField label="Final CTA title" value={content.finalCtaTitle} onChange={(v) => set("finalCtaTitle", v)} />
      </EditorSection>

      <EditorSection title="Community">
        <TextField label="Community section eyebrow" value={content.communityEyebrow} onChange={(v) => set("communityEyebrow", v)} />
        <TextField label="Community section title" value={content.communityTitle} onChange={(v) => set("communityTitle", v)} />
        <RichTextField label="Community section description" value={content.communityDescription} onChange={(v) => set("communityDescription", v)} />
        <TextField label="Community primary CTA label" value={content.communityCtaPrimaryLabel} onChange={(v) => set("communityCtaPrimaryLabel", v)} />
        <TextField label="Community primary CTA URL" value={content.communityCtaPrimaryHref} onChange={(v) => set("communityCtaPrimaryHref", v)} />
        <TextField label="Community secondary CTA label" value={content.communityCtaSecondaryLabel} onChange={(v) => set("communityCtaSecondaryLabel", v)} />
        <TextField label="Community secondary CTA URL" value={content.communityCtaSecondaryHref} onChange={(v) => set("communityCtaSecondaryHref", v)} />
        <TextField label="Connect Community button label" value={content.communityCtaCommunityLabel} onChange={(v) => set("communityCtaCommunityLabel", v)} />
        <TextField label="Connect Community button URL" value={content.communityCtaCommunityHref} onChange={(v) => set("communityCtaCommunityHref", v)} />
      </EditorSection>
    </div>
  );
}

function ContactEditor({ content, onChange }) {
  const ui = useCmsUi();
  function set(field, value) {
    onChange({ ...content, [field]: value });
  }

  return (
    <div className="space-y-6">
      <EditorSection title="Contact page (left column)">
        <TextField label="Heading" value={content.heading} onChange={(v) => set("heading", v)} />
        <RichTextField
          label="Description"
          value={content.description}
          onChange={(v) => set("description", v)}
        />
        <StringListField
          label="Contact items (email / phone lines)"
          items={Array.isArray(content.contactItems) ? content.contactItems : []}
          onChange={(v) => set("contactItems", v)}
        />
      </EditorSection>

      <EditorSection title="Form & success messages (right column)">
        <TextField label="Form panel eyebrow / title" value={content.formTitle} onChange={(v) => set("formTitle", v)} />
        <TextField label="Success title (delivered immediately)" value={content.successTitle} onChange={(v) => set("successTitle", v)} />
        <TextAreaField
          label="Success description (delivered immediately)"
          value={content.successDescription}
          onChange={(v) => set("successDescription", v)}
          rows={3}
        />
        <TextField
          label="Queued success title (no manager online)"
          value={content.queuedSuccessTitle}
          onChange={(v) => set("queuedSuccessTitle", v)}
        />
        <TextAreaField
          label="Queued success description"
          value={content.queuedSuccessDescription}
          onChange={(v) => set("queuedSuccessDescription", v)}
          rows={4}
        />
        <p className={`text-xs ${ui.itemCardHeader}`}>
          These strings map to the public{" "}
          <code className={ui.inlineCode}>/contact-us</code> page after publish.
        </p>
      </EditorSection>
    </div>
  );
}

function PrivacyEditor({ content, onChange }) {
  const ui = useCmsUi();
  function set(field, value) {
    onChange({ ...content, [field]: value });
  }

  return (
    <div className="space-y-6">
      <EditorSection title="Policy header">
        <TextField label="Heading" value={content.heading} onChange={(v) => set("heading", v)} />
        <TextField label="Effective date" value={content.effectiveDate} onChange={(v) => set("effectiveDate", v)} />
      </EditorSection>
      <EditorSection title="Policy body">
        <SectionsField
          label="Sections"
          items={Array.isArray(content.sections) ? content.sections : []}
          onChange={(v) => set("sections", v)}
        />
        <p className={`text-xs ${ui.itemCardHeader}`}>
          Published to <code className={ui.inlineCode}>/privacy-policy</code>.
        </p>
      </EditorSection>
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
 *   variant  – "dark" (admin shell) | "light" (app content editor on white)
 */
function CmsEditorBody({ pageKey, content, onChange }) {
  const ui = useCmsUi();
  if (pageKey === "home") {
    return <HomeEditor content={content} onChange={onChange} />;
  }
  if (pageKey === "contact-us") {
    return <ContactEditor content={content} onChange={onChange} />;
  }
  if (pageKey === "privacy-policy") {
    return <PrivacyEditor content={content} onChange={onChange} />;
  }
  return <p className={`text-sm ${ui.itemCardHeader}`}>No structured editor for this page key.</p>;
}

export default function CmsEditor({ pageKey, content = {}, onChange, variant = "dark" }) {
  const ui = variant === "light" ? CMS_UI.light : CMS_UI.dark;
  return (
    <CmsEditorUiContext.Provider value={ui}>
      <CmsEditorBody pageKey={pageKey} content={content} onChange={onChange} />
    </CmsEditorUiContext.Provider>
  );
}
