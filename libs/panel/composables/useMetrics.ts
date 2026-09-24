import {
  METRIC_FIELDS,
  formatMetricValue,
  type MetricGroup,
  type NumericMetricKey,
  type PercentileBand,
} from '@kcs/contract'

/** 指标的标签、口径与按单位格式化；分位色带统一在这里定色。 */
export function useMetrics() {
  const { t, te, locale } = useI18n()

  function label(key: NumericMetricKey | 'followers'): string {
    const k = `kcs.metric.${key}`
    return te(k) ? t(k) : key
  }

  function help(key: NumericMetricKey): string {
    const k = `kcs.metricHelp.${key}`
    return te(k) ? t(k) : ''
  }

  function groupLabel(group: MetricGroup): string {
    return t(`kcs.metricGroup.${group}`)
  }

  function format(key: NumericMetricKey, value: number | null | undefined, compact = false): string {
    if (value == null) return '—'
    return formatMetricValue(key, Number(value), locale.value, { compact })
  }

  function bandClass(band?: PercentileBand | null): string {
    switch (band) {
      case 'top10':
        return 'text-primary font-semibold'
      case 'top25':
        return 'text-primary'
      case 'upper':
        return 'text-foreground'
      case 'lower':
        return 'text-muted-foreground'
      case 'bottom':
        return 'text-amber-700 dark:text-amber-300'
      default:
        return 'text-foreground'
    }
  }

  function bandDot(band?: PercentileBand | null): string {
    switch (band) {
      case 'top10':
        return 'bg-primary'
      case 'top25':
        return 'bg-primary/60'
      case 'upper':
        return 'bg-foreground/40'
      case 'lower':
        return 'bg-muted-foreground/40'
      case 'bottom':
        return 'bg-amber-500'
      default:
        return 'bg-transparent'
    }
  }

  function bandLabel(band?: PercentileBand | null): string {
    return t(`kcs.band.${band ?? 'none'}`)
  }

  const groups: MetricGroup[] = ['scale', 'reach', 'cost', 'conversion', 'potential', 'trust']

  function fieldsIn(group: MetricGroup) {
    return METRIC_FIELDS.filter((f) => f.group === group)
  }

  return { label, help, groupLabel, format, bandClass, bandDot, bandLabel, groups, fieldsIn, fields: METRIC_FIELDS }
}
