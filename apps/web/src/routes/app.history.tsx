import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'

import { getHistoryData } from '#/functions/devices'
import type { ReadingInput } from '@sensa/contracts'

import { DisclaimerFooter } from '#/components/app-shell'
import { TimelineChart } from '#/components/timeline-chart'
import { Button } from '#/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'

import { useLocale } from '#/lib/i18n/index'
import { formatDateTime, formatNumber } from '#/lib/format'

export const Route = createFileRoute('/app/history')({
  loader: () => getHistoryData(),
  component: HistoryPage,
})

const RANGES = [
  { id: '1h', ms: 60 * 60 * 1000 },
  { id: '6h', ms: 6 * 60 * 60 * 1000 },
  { id: '24h', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
] as const

type RangeId = (typeof RANGES)[number]['id']

function HistoryPage() {
  const result = Route.useLoaderData()
  const { t, locale } = useLocale()
  const [range, setRange] = useState<RangeId>('6h')

  if (!result.ok) {
    return (
      <div>
        <p className="rounded-xl bg-alert-tint px-4 py-3 text-sm font-bold text-alert-ink">
          {t('common.error')}
        </p>
        <DisclaimerFooter />
      </div>
    )
  }

  const { anchor, readings } = result.data

  const rangeMs = RANGES.find((r) => r.id === range)?.ms ?? RANGES[1].ms
  const filtered: ReadingInput[] = useMemo(
    () =>
      readings.filter((r) => new Date(r.capturedAt).getTime() >= anchor - rangeMs),
    [readings, anchor, rangeMs],
  )

  const chartReadings = useMemo(
    () => filtered.filter((_, i) => i % Math.max(1, Math.ceil(filtered.length / 120)) === 0),
    [filtered],
  )

  const tableRows = useMemo(() => [...filtered].reverse().slice(0, 120), [filtered])

  function download(kind: 'csv' | 'jsonl') {
    let content: string
    if (kind === 'csv') {
      const header =
        'capturedAt,hrBpm,spo2Pct,tempC,gsrOhm,accelX,accelY,accelZ,status,flags'
      const rows = filtered.map((r) =>
        [
          r.capturedAt,
          r.hrBpm ?? '',
          r.spo2Pct ?? '',
          r.tempC ?? '',
          r.gsrOhm ?? '',
          r.accelX ?? '',
          r.accelY ?? '',
          r.accelZ ?? '',
          r.status,
          `"${(r.flags ?? []).join('|')}"`,
        ].join(','),
      )
      content = [header, ...rows].join('\n')
    } else {
      content = filtered.map((r) => JSON.stringify(r)).join('\n')
    }
    const blob = new Blob([content], {
      type: kind === 'csv' ? 'text/csv;charset=utf-8' : 'application/x-ndjson',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sensa-readings.${kind}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">{t('history.title')}</h1>
          <p className="mt-1.5 text-sm text-ink-soft">{t('history.subtitle')}</p>
        </div>
      </header>

      <div
        className="mt-5 flex flex-wrap items-center gap-2"
        role="group"
        aria-label={t('history.title')}
      >
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={range === r.id}
            onClick={() => setRange(r.id)}
            className={`rounded-lg px-3.5 py-2 text-sm font-bold transition-colors ${
              range === r.id
                ? 'bg-primary text-primary-ink'
                : 'border border-line bg-surface text-ink-soft hover:bg-muted'
            }`}
          >
            {t(`history.range.${r.id}`)}
          </button>
        ))}
        <span className="tnum ms-auto text-sm text-ink-soft">
          {t('history.count', { n: formatNumber(filtered.length, locale) })}
        </span>
        <Button variant="outline" size="sm" onClick={() => download('csv')}>
          <Download className="h-4 w-4" aria-hidden="true" />
          {t('action.exportCsv')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => download('jsonl')}>
          <Download className="h-4 w-4" aria-hidden="true" />
          {t('action.exportJsonl')}
        </Button>
      </div>

      <section className="card-soft mt-4 rounded-2xl p-4 md:p-6">
        {chartReadings.length > 1 ? (
          <TimelineChart readings={chartReadings} />
        ) : (
          <p className="py-8 text-center text-sm text-ink-faint">{t('history.empty')}</p>
        )}
      </section>

      <section className="card-soft mt-6 overflow-hidden rounded-2xl">
        {tableRows.length === 0 ? (
          <p className="p-6 text-sm text-ink-soft">{t('history.empty')}</p>
        ) : (
          <div className="max-h-[480px] overflow-x-auto overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-surface">
                <TableRow>
                  <TableHead className="text-start">{t('history.table.time')}</TableHead>
                  <TableHead className="text-start">{t('history.table.hr')}</TableHead>
                  <TableHead className="text-start">{t('history.table.spo2')}</TableHead>
                  <TableHead className="text-start">{t('history.table.temp')}</TableHead>
                  <TableHead className="hidden text-start sm:table-cell">{t('history.table.gsr')}</TableHead>
                  <TableHead className="hidden text-start sm:table-cell">{t('history.table.motion')}</TableHead>
                  <TableHead className="text-start">{t('history.table.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.map((r, i) => (
                  <TableRow key={`${r.capturedAt}-${i}`}>
                    <TableCell className="tnum whitespace-nowrap text-ink-soft">
                      {formatDateTime(r.capturedAt, locale)}
                    </TableCell>
                    <TableCell className="tnum font-bold">
                      {r.hrBpm != null ? formatNumber(r.hrBpm, locale, 0) : '—'}
                    </TableCell>
                    <TableCell className="tnum">
                      {r.spo2Pct != null ? `${formatNumber(r.spo2Pct, locale, 0)}%` : '—'}
                    </TableCell>
                    <TableCell className="tnum">
                      {r.tempC != null ? formatNumber(r.tempC, locale, 1) : '—'}
                    </TableCell>
                    <TableCell className="tnum hidden sm:table-cell">
                      {r.gsrOhm != null ? formatNumber(r.gsrOhm / 1000, locale, 0) : '—'}
                    </TableCell>
                    <TableCell className="tnum hidden sm:table-cell">
                      {r.accelX != null && r.accelY != null && r.accelZ != null
                        ? formatNumber(
                            Math.sqrt(r.accelX ** 2 + r.accelY ** 2 + r.accelZ ** 2),
                            locale,
                            1,
                          )
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          r.status === 'SAFE'
                            ? 'bg-safe-tint text-safe-ink'
                            : r.status === 'WATCH'
                              ? 'bg-watch-tint text-watch-ink'
                              : 'bg-alert-tint text-alert-ink'
                        }`}
                      >
                        {t(`status.${r.status.toLowerCase()}`)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <DisclaimerFooter />
    </div>
  )
}
