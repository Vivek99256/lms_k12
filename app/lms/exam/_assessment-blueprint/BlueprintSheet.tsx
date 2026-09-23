'use client';

// ---------------------------------------------------------------------------
// A blueprint as a printed document.
//
// One component for both kinds, because a coordinator taking a blueprint into
// a meeting wants the same paper either way — the school's letterhead, what the
// design is, and then the tables. What differs is only what those tables hold:
// a marks-based design prints its sections and weightings, an HPC prints its
// proficiency scale and its NCF chain, and an HPC prints no marks anywhere
// because it has none.
//
// `data-pdf-block` marks every place the paginator may cut. Page breaks land on
// those boundaries and nowhere else, so a section heading is never stranded at
// the foot of a page without its rows, and a table is never sliced mid-row.
//
// Rendered at the page's real content width by the exporter and shown at the
// same width in the preview, so what is on screen is what comes out.
// ---------------------------------------------------------------------------

import type {
  Blueprint,
  BlueprintSection,
  HpcArea,
  HpcDefinition,
  BlueprintDefinition,
} from './types';

export type SheetBranding = { name: string; logoUrl: string | null };

type Props = { blueprint: Blueprint; branding: SheetBranding };

function trim(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** count x (subparts or 1) x marks-each, the row's own arithmetic. */
function rowUnits(count: number, subparts: number): string {
  return subparts > 0 ? `${count} x ${subparts} parts` : String(count);
}

function sectionMarks(section: BlueprintSection): number {
  return Math.round(section.rows.reduce((sum, row) => sum + row.total_marks, 0) * 100) / 100;
}

export default function BlueprintSheet({ blueprint, branding }: Props) {
  const facets = [
    blueprint.board,
    blueprint.kind === 'hpc' ? blueprint.stage : blueprint.class_band,
    blueprint.subject_label || blueprint.subject_name,
    blueprint.assessment_type,
    blueprint.academic_year,
  ].filter(Boolean);

  return (
    <div className="blueprint-sheet" style={sheetStyle}>
      <header data-pdf-block style={{ marginBottom: 10, textAlign: 'center' }}>
        {branding.logoUrl || branding.name ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              marginBottom: 2,
            }}
          >
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt="" style={{ height: 40, width: 40, objectFit: 'contain' }} />
            ) : null}
            {branding.name ? (
              <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                {branding.name}
              </span>
            ) : null}
          </div>
        ) : null}

        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: '#475569',
          }}
        >
          {blueprint.kind === 'hpc' ? 'Holistic Progress Card — Blueprint' : 'Assessment Blueprint'}
        </div>

        <h1 style={{ margin: '6px 0 0', fontSize: 16, fontWeight: 700 }}>{blueprint.name}</h1>

        {facets.length > 0 ? (
          <div style={{ marginTop: 3, fontSize: 11, color: '#334155' }}>{facets.join('  ·  ')}</div>
        ) : null}

        {/* The double rule under a masthead is the convention every board paper
            in this module already prints; a blueprint is read alongside them. */}
        <div style={{ marginTop: 8, borderBottom: '3px double #0f172a' }} />
      </header>

      {blueprint.description ? (
        <p
          data-pdf-block
          style={{
            margin: '0 0 10px',
            fontSize: 11,
            lineHeight: 1.6,
            color: '#475569',
            textAlign: 'center',
            fontStyle: 'italic',
          }}
        >
          {blueprint.description}
        </p>
      ) : null}

      {blueprint.kind === 'hpc' ? (
        <HpcBody definition={blueprint.definition} />
      ) : (
        <RegularBody blueprint={blueprint} definition={blueprint.definition} />
      )}

      <footer data-pdf-block style={{ marginTop: 16, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: 9.5, color: '#94a3b8', lineHeight: 1.6, textAlign: 'center' }}>
          {blueprint.source ? <>Source: {blueprint.source}. </> : null}
          {blueprint.source_url ? <>{blueprint.source_url}</> : null}
        </div>
      </footer>
    </div>
  );
}

// -- Marks-based ------------------------------------------------------------

function RegularBody({
  blueprint,
  definition,
}: {
  blueprint: Blueprint;
  definition: BlueprintDefinition;
}) {
  const totalFromSections = definition.sections.reduce((sum, s) => sum + sectionMarks(s), 0);

  return (
    <>
      <Stats
        items={[
          ['Total marks', trim(blueprint.total_marks)],
          ['Sections add up to', trim(totalFromSections)],
          [
            'Questions',
            String(
              definition.sections.reduce(
                (sum, s) => sum + s.rows.reduce((rows, r) => rows + r.count, 0),
                0
              )
            ),
          ],
          ...(blueprint.duration_minutes ? ([['Duration', `${blueprint.duration_minutes} min`]] as const) : []),
          ...(definition.internal_choice_pct > 0
            ? ([['Internal choice', `${trim(definition.internal_choice_pct)}%`]] as const)
            : []),
        ]}
      />

      <Section title="Paper structure">
        <table style={tableStyle}>
          <thead>
            <tr>
              <Th>Section</Th>
              <Th>Type of questions</Th>
              <Th align="right">Questions</Th>
              <Th align="right">Marks each</Th>
              <Th align="right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {definition.sections.map((section) =>
              section.rows.map((row, rowIndex) => (
                <tr key={row.id} data-pdf-block>
                  <Td>
                    {rowIndex === 0 ? (
                      <>
                        <strong>{section.name}</strong>
                        {section.note ? <Note>{section.note}</Note> : null}
                      </>
                    ) : null}
                  </Td>
                  <Td>
                    {row.label || row.question_type}
                    {row.question_numbers ? <Muted> Q{row.question_numbers}</Muted> : null}
                    {row.note ? <Note>{row.note}</Note> : null}
                  </Td>
                  <Td align="right">{rowUnits(row.count, row.subparts)}</Td>
                  <Td align="right">{trim(row.marks_each)}</Td>
                  <Td align="right">
                    <strong>{trim(row.total_marks)}</strong>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Section>

      {definition.content_weightage.length > 0 ? (
        <Section title="Chapter weightage">
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>Content area</Th>
                <Th align="right">Marks</Th>
                <Th align="right">Share</Th>
              </tr>
            </thead>
            <tbody>
              {definition.content_weightage.map((area) => (
                <tr key={area.id} data-pdf-block>
                  <Td>
                    {area.name}
                    {area.note ? <Note>{area.note}</Note> : null}
                  </Td>
                  <Td align="right">{trim(area.marks)}</Td>
                  <Td align="right">{trim(area.weight_pct)}%</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {definition.competency_distribution.length > 0 ? (
        <Section title="Competency weightage">
          <table style={tableStyle}>
            <tbody>
              {definition.competency_distribution.map((band) => (
                <tr key={band.id} data-pdf-block>
                  <Td>{band.label}</Td>
                  <Td align="right">{trim(band.weight_pct)}%</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      ) : null}

      {definition.difficulty_distribution.easy +
        definition.difficulty_distribution.average +
        definition.difficulty_distribution.difficult >
      0 ? (
        <Section title="Difficulty split">
          <div style={{ fontSize: 11.5, color: '#334155' }}>
            Easy {trim(definition.difficulty_distribution.easy)}% · Average{' '}
            {trim(definition.difficulty_distribution.average)}% · Difficult{' '}
            {trim(definition.difficulty_distribution.difficult)}%
          </div>
        </Section>
      ) : null}

      {definition.notes ? <Notes text={definition.notes} /> : null}
    </>
  );
}

// -- HPC ---------------------------------------------------------------------

function HpcBody({ definition }: { definition: HpcDefinition }) {
  const goals = definition.areas.reduce((sum, area) => sum + area.curricular_goals.length, 0);
  const competencies = definition.areas.reduce(
    (sum, area) => sum + area.curricular_goals.reduce((g, goal) => g + goal.competencies.length, 0),
    0
  );
  const areaNoun = definition.stage === 'Foundational' ? 'Development domains' : 'Curricular areas';

  return (
    <>
      <Stats
        items={[
          ['Stage', definition.stage],
          [areaNoun, String(definition.areas.length)],
          ['Curricular goals', String(goals)],
          ['Competencies', String(competencies)],
          // Said outright rather than left as a blank column: a reader used to
          // mark sheets should not have to work out that none are missing.
          ['Marks', 'None'],
        ]}
      />

      <Section title="Proficiency scale">
        <table style={tableStyle}>
          <tbody>
            {definition.proficiency_scale.map((level) => (
              <tr key={level.code} data-pdf-block>
                <Td width="28%">
                  <strong>{level.label}</strong>
                </Td>
                <Td>{level.descriptor || <Muted>no descriptor set</Muted>}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={areaNoun}>
        {definition.areas.map((area) => (
          <AreaBlock key={area.id} area={area} />
        ))}
      </Section>

      {definition.abilities.length > 0 ? (
        <Section title="Abilities scored per activity">
          <div style={{ fontSize: 11.5, color: '#334155' }}>
            {definition.abilities.map((ability) => ability.label).join(' · ')}
          </div>
        </Section>
      ) : null}

      <Section title="How it is assessed">
        <table style={tableStyle}>
          <tbody>
            <tr data-pdf-block>
              <Td width="28%">
                <strong>Who assesses</strong>
              </Td>
              <Td>{definition.assessors.join(', ') || <Muted>none set</Muted>}</Td>
            </tr>
            <tr data-pdf-block>
              <Td>
                <strong>Activity approaches</strong>
              </Td>
              <Td>{definition.activity_approaches.join(', ') || <Muted>none set</Muted>}</Td>
            </tr>
            <tr data-pdf-block>
              <Td>
                <strong>Evidence from</strong>
              </Td>
              <Td>{definition.evidence_modes.join(', ') || <Muted>none set</Muted>}</Td>
            </tr>
            <tr data-pdf-block>
              <Td>
                <strong>The child&apos;s own pages</strong>
              </Td>
              <Td>
                {Object.entries(definition.part_a)
                  .filter(([, on]) => on)
                  .map(([key]) => key.replace(/_/g, ' '))
                  .join(', ') || <Muted>none set</Muted>}
              </Td>
            </tr>
          </tbody>
        </table>
      </Section>

      {definition.notes ? <Notes text={definition.notes} /> : null}
    </>
  );
}

function AreaBlock({ area }: { area: HpcArea }) {
  return (
    <div data-pdf-block style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{area.name}</div>
      {area.note ? <Note>{area.note}</Note> : null}

      {area.curricular_goals.length === 0 ? (
        <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>
          No curricular goals set — take them from the NCF for this stage.
        </div>
      ) : (
        <div style={{ marginTop: 4, paddingLeft: 10, borderLeft: '2px solid #e2e8f0' }}>
          {area.curricular_goals.map((goal) => (
            <div key={goal.id} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: '#334155' }}>
                {goal.code ? <strong>{goal.code} </strong> : null}
                {goal.name}
              </div>

              {goal.competencies.map((competency) => (
                <div key={competency.id} style={{ marginTop: 3, paddingLeft: 10 }}>
                  <div style={{ fontSize: 10.5, color: '#475569' }}>
                    {competency.code ? <strong>{competency.code} </strong> : null}
                    {competency.name}
                  </div>
                  {competency.learning_outcomes.length > 0 ? (
                    <ul style={{ margin: '2px 0 0', paddingLeft: 16 }}>
                      {competency.learning_outcomes.map((outcome) => (
                        <li key={outcome} style={{ fontSize: 10, color: '#64748b', lineHeight: 1.5 }}>
                          {outcome}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -- Shared pieces ------------------------------------------------------------

const sheetStyle: React.CSSProperties = {
  background: '#ffffff',
  color: '#0f172a',
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 12,
  lineHeight: 1.5,
  width: '100%',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 11,
  border: '1px solid #94a3b8',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 12 }}>
      <h2
        data-pdf-block
        style={{
          margin: '0 0 6px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: '#0f172a',
          textAlign: 'center',
          borderBottom: '1px solid #cbd5e1',
          paddingBottom: 3,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * The paper's own particulars, laid out the way a board paper lays them out:
 * split left and right with a rule under, rather than as a row of web chips.
 * Odd counts put the extra item on the left, which is where a reader's eye
 * starts.
 */
function Stats({ items }: { items: ReadonlyArray<readonly [string, string]> }) {
  const half = Math.ceil(items.length / 2);
  const columns = [items.slice(0, half), items.slice(half)];

  return (
    <div
      data-pdf-block
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 24,
        marginBottom: 10,
        paddingBottom: 6,
        borderBottom: '1px solid #cbd5e1',
      }}
    >
      {columns.map((column, columnIndex) => (
        <div
          key={columnIndex}
          style={{ textAlign: columnIndex === 0 ? 'left' : 'right', fontSize: 11.5 }}
        >
          {column.map(([label, value]) => (
            <div key={label} style={{ marginBottom: 1 }}>
              <span style={{ color: '#64748b' }}>{label}: </span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Notes({ text }: { text: string }) {
  return (
    <Section title="Notes">
      <div style={{ fontSize: 11, lineHeight: 1.7, color: '#475569', whiteSpace: 'pre-line' }}>
        {text}
      </div>
    </Section>
  );
}

function Th({ children, align }: { children?: React.ReactNode; align?: 'right' }) {
  return (
    <th
      style={{
        textAlign: align ?? 'left',
        padding: '5px 7px',
        border: '1px solid #94a3b8',
        background: '#f1f5f9',
        fontSize: 9,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#64748b',
        fontWeight: 600,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  width,
}: {
  children?: React.ReactNode;
  align?: 'right';
  width?: string;
}) {
  return (
    <td
      style={{
        textAlign: align ?? 'left',
        padding: '5px 7px',
        border: '1px solid #cbd5e1',
        verticalAlign: 'top',
        width,
      }}
    >
      {children}
    </td>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: 'block', fontSize: 9.5, color: '#94a3b8', marginTop: 1 }}>{children}</span>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span style={{ color: '#94a3b8' }}>{children}</span>;
}
