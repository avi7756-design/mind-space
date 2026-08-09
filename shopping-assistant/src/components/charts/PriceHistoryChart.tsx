import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PricePoint } from '../../types';
import { formatCurrency, formatDate } from '../../services/format';

interface Props {
  history: PricePoint[];
  targetPrice?: number;
  height?: number;
}

export default function PriceHistoryChart({ history, targetPrice, height = 220 }: Props) {
  return (
    // Time-series charts stay LTR (oldest on the left) even in an RTL layout
    <div dir="ltr">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={history} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b63f6" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#3b63f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => formatDate(d)}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          orientation="right"
          tickFormatter={(v: number) => formatCurrency(v)}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          tickLine={false}
          axisLine={false}
          width={70}
          domain={['auto', 'auto']}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value)), 'מחיר']}
          labelFormatter={(label) => formatDate(String(label))}
          contentStyle={{
            direction: 'rtl',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            fontSize: 12,
          }}
        />
        {targetPrice !== undefined && (
          <ReferenceLine
            y={targetPrice}
            stroke="#10b981"
            strokeDasharray="6 4"
            label={{ value: 'יעד', position: 'left', fill: '#10b981', fontSize: 11 }}
          />
        )}
          <Area type="monotone" dataKey="price" stroke="#3b63f6" strokeWidth={2} fill="url(#priceFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
