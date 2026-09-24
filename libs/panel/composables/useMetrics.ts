import {
  FIVE_BAND_MIN_SAMPLE,
  METRIC_FIELDS,
  basisFamily,
  costFellBack,
  formatMetricValue,
  metricBasisOf,
  type CreatorMetrics,
  type MetricGroup,
  type MetricPercentile,
  type NumericMetricKey,
  type PercentileBand,
  type PercentileCohort,
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

  /** 「全部流量 · 日常笔记」 from `metrics.basis`, or '' when the record was not fetched under a scope. */
  function scopeLine(basis?: Record<string, string> | null): string {
    const traffic = basis?.trafficScope
    const business = basis?.businessScope
    if (!traffic || !business || !te(`kcs.scope.traffic.${traffic}`) || !te(`kcs.scope.business.${business}`)) return ''
    return t('kcs.scope.line', { traffic: t(`kcs.scope.traffic.${traffic}`), business: t(`kcs.scope.business.${business}`) })
  }

  type BasisOf = Pick<CreatorMetrics, 'basis'> & Partial<Pick<CreatorMetrics, 'derived'>>

  /** Only records fetched under a recorded scope say which one; older ones and other sources stay silent. */
  function hasScope(metrics?: BasisOf | null): metrics is BasisOf {
    return Boolean(metrics?.basis?.trafficScope && metrics.basis.businessScope)
  }

  /** 「成本按合作笔记计。」/「传播按自然流量计，不含投放。」 for a metric that depends on it, else ''. */
  function basisSentence(key: NumericMetricKey, metrics?: BasisOf | null): string {
    if (!hasScope(metrics)) return ''
    const family = basisFamily(key)
    const basis = metricBasisOf(key, metrics)
    if (family === 'cost') return t(`kcs.scope.cost.${basis === 'daily' && costFellBack(metrics) ? 'fallback' : basis}`)
    if (family === 'reach') return t(`kcs.scope.reach.${basis}`)
    return ''
  }

  /** `help(key)`, plus which traffic or notes the number is on when it depends on that. */
  function helpIn(key: NumericMetricKey, metrics?: BasisOf | null): string {
    const base = help(key)
    const hint = basisSentence(key, metrics)
    if (!hint) return base
    return base ? `${base} ${hint}` : hint
  }

  /** Short 口径 label for a group header: the cost group says which notes, a group with reach figures which traffic. */
  function groupBasis(group: MetricGroup, metrics?: BasisOf | null): string {
    if (!hasScope(metrics)) return ''
    const keys = METRIC_FIELDS.filter((field) => field.group === group).map((field) => field.key)
    const cost = keys.find((key) => basisFamily(key) === 'cost')
    if (cost) {
      const basis = metricBasisOf(cost, metrics)
      return t(`kcs.scope.short.${basis === 'daily' && costFellBack(metrics) ? 'fallback' : basis}`)
    }
    const reach = keys.find((key) => basisFamily(key) === 'reach')
    return reach ? t(`kcs.scope.short.${metricBasisOf(reach, metrics)}`) : ''
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
      case 'front':
        return 'text-primary'
      case 'upper':
      case 'middle':
        return 'text-foreground'
      case 'lower':
      case 'back':
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
      case 'front':
        return 'bg-primary/60'
      case 'upper':
      case 'middle':
        return 'bg-foreground/40'
      case 'lower':
      case 'back':
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

  /**
   * Who a percentile compares with, in words: the platform's own figure
   * (小红书「超过 X% 同类」) or our library's peers — same source and period,
   * similar follower count — with a note when the group is small.
   */
  function rankText(rank: MetricPercentile | null | undefined, cohort?: PercentileCohort | null): string[] {
    if (!rank) return []
    const source = cohort?.source ? t(`kcs.source.${cohort.source}`) : ''
    const library = (r: Omit<MetricPercentile, 'library' | 'scope'>) => {
      const lines = [
        r.followersMin != null && r.followersMax != null
          ? t('kcs.band.cohortLibrary', { n: r.n, source, min: format('followers', r.followersMin, true), max: format('followers', r.followersMax, true) })
          : t('kcs.band.cohortUnknown', { n: r.n, source }),
      ]
      if (r.n < FIVE_BAND_MIN_SAMPLE) lines.push(t('kcs.band.fewPeers'))
      return lines
    }
    if (rank.scope === 'platform') {
      return [t('kcs.band.platform', { pct: rank.percentile }), ...(rank.library ? library(rank.library) : [])]
    }
    return library(rank)
  }

  const groups: MetricGroup[] = ['scale', 'reach', 'cost', 'conversion', 'potential', 'trust']

  /** Hidden fields (no trustworthy definition yet) stay out of every list. */
  function fieldsIn(group: MetricGroup) {
    return METRIC_FIELDS.filter((f) => f.group === group && !f.hidden)
  }

  return { label, help, helpIn, basisSentence, groupBasis, scopeLine, groupLabel, format, bandClass, bandDot, bandLabel, rankText, groups, fieldsIn, fields: METRIC_FIELDS }
}
