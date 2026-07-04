import { useMemo, useState } from "react";
import { fmtDate } from "../lib/store";
import {
  aggregateByDate,
  buildYearGrid,
  formatDayRefs,
  maxVerseCountInYear,
  readingYears,
  tierForVerseCount,
  yearSummary,
} from "../lib/readingCalendar";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabelsForWeeks(weeks) {
  return weeks.map((week, wi) => {
    const first = week.find((c) => c.inYear);
    if (!first) return "";
    const month = first.month;
    if (wi === 0) return MONTH_LABELS[month];
    const prev = weeks[wi - 1].find((c) => c.inYear);
    if (!prev || prev.month !== month) return MONTH_LABELS[month];
    return "";
  });
}

export default function ReadingCalendar({ reads }) {
  const years = useMemo(() => readingYears(reads), [reads]);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [selectedDate, setSelectedDate] = useState(null);

  const effectiveYear = years.includes(year) ? year : currentYear;
  const byDate = useMemo(() => aggregateByDate(reads), [reads]);
  const weeks = useMemo(() => buildYearGrid(effectiveYear, byDate), [effectiveYear, byDate]);
  const maxInYear = useMemo(() => maxVerseCountInYear(reads, effectiveYear), [reads, effectiveYear]);
  const summary = useMemo(() => yearSummary(reads, effectiveYear), [reads, effectiveYear]);
  const monthLabels = useMemo(() => monthLabelsForWeeks(weeks), [weeks]);

  const selected = selectedDate ? byDate.get(selectedDate) : null;
  const yearIndex = years.indexOf(effectiveYear);

  return (
    <section className="reading-calendar">
      <div className="cal-header">
        <div>
          <h2>Reading activity</h2>
          <p className="section-hint">
            {summary.days} day{summary.days === 1 ? "" : "s"} · {summary.verses.toLocaleString()} verse
            {summary.verses === 1 ? "" : "s"} · {summary.logs} log{summary.logs === 1 ? "" : "s"} in {effectiveYear}
          </p>
        </div>
        <div className="cal-year-nav">
          <button
            type="button"
            className="ghost-btn cal-nav-btn"
            disabled={yearIndex >= years.length - 1}
            onClick={() => {
              setSelectedDate(null);
              setYear(years[yearIndex + 1]);
            }}
            aria-label="Previous year"
          >
            ←
          </button>
          <span className="cal-year-label">{effectiveYear}</span>
          <button
            type="button"
            className="ghost-btn cal-nav-btn"
            disabled={yearIndex <= 0}
            onClick={() => {
              setSelectedDate(null);
              setYear(years[yearIndex - 1]);
            }}
            aria-label="Next year"
          >
            →
          </button>
        </div>
      </div>

      <div className="cal-scroll">
        <div className="cal-grid-wrap">
          <div className="cal-day-labels" aria-hidden="true">
            <span />
            {DAY_LABELS.map((label, i) => (
              <span key={label} className={i % 2 === 0 ? "cal-day-label" : "cal-day-label cal-day-label-sparse"}>
                {i % 2 === 0 ? label : ""}
              </span>
            ))}
          </div>

          <div className="cal-weeks">
            <div className="cal-month-row" aria-hidden="true">
              {monthLabels.map((label, i) => (
                <span key={i} className="cal-month-label">
                  {label}
                </span>
              ))}
            </div>

            <div className="cal-cells">
              {weeks.map((week, wi) => (
                <div key={wi} className="cal-week">
                  {week.map((cell) => {
                    if (!cell.inYear) {
                      return <span key={cell.date} className="cal-cell cal-cell-outside" />;
                    }
                    const tier = tierForVerseCount(cell.verseCount, maxInYear);
                    const isSelected = selectedDate === cell.date;
                    const title =
                      cell.verseCount > 0
                        ? `${fmtDate(cell.date)}: ${cell.verseCount} verse${cell.verseCount === 1 ? "" : "s"}`
                        : fmtDate(cell.date);
                    return (
                      <button
                        key={cell.date}
                        type="button"
                        className={`cal-cell cal-tier-${tier}${isSelected ? " selected" : ""}`}
                        title={title}
                        aria-label={title}
                        onClick={() => setSelectedDate(isSelected ? null : cell.date)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="cal-legend">
        <span className="cal-legend-label">Less</span>
        {[0, 1, 2, 3, 4].map((t) => (
          <span key={t} className={`cal-cell cal-tier-${t} cal-legend-swatch`} />
        ))}
        <span className="cal-legend-label">More</span>
      </div>

      {selectedDate && (
        <div className="cal-day-detail">
          <div className="cal-day-detail-head">
            <strong>{fmtDate(selectedDate)}</strong>
            {selected ? (
              <span className="cal-day-detail-meta">
                {selected.verseCount} verse{selected.verseCount === 1 ? "" : "s"} · {selected.reads.length}{" "}
                log{selected.reads.length === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="cal-day-detail-meta">No reading logged</span>
            )}
            <button type="button" className="delete-btn" onClick={() => setSelectedDate(null)}>
              ✕
            </button>
          </div>
          {selected && selected.reads.length > 0 && (
            <ul className="cal-day-reads">
              {selected.reads.map((r) => (
                <li key={r.id}>{formatDayRefs([r])}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
