import { useState, useEffect } from 'react';
import api from '../services/api';

/**
 * 🔢 SerialPicker — اختيار السريالات من الرصيد المتاح بالمخزن
 * بتسحب السريالات المتاحة (والمحجوزة لهذا المستند) من item_serials
 * وتستخدم في: إذن التسليم، أمر الشغل، إذن صرف المخزن فقط
 *
 * Props:
 * - itemId: كود الصنف (إجباري)
 * - warehouseId: المخزن (إجباري لجلب الرصيد)
 * - count: الكمية المطلوبة (عدد السريالات المطلوب اختيارها)
 * - value: مصفوفة السريالات المختارة حالياً
 * - onChange: (newArray) => void
 */
function SerialPicker({ itemId, warehouseId, count, value = [], onChange }) {
  const [stockSerials, setStockSerials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!itemId || !warehouseId) { setStockSerials([]); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const r = await api.get(`/warehouse-issues/available-serials/${itemId}`, {
          params: { warehouse_id: warehouseId, include_reserved: 1 }
        });
        if (!cancelled) setStockSerials(Array.isArray(r.data) ? r.data : []);
      } catch (e) {
        if (!cancelled) { setStockSerials([]); setError('تعذر جلب السريالات من المخزن'); }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [itemId, warehouseId]);

  const selected = Array.isArray(value) && value.length > 0 
  ? value 
  : stockSerials.filter(s => s.status === 'reserved').map(s => s.serial_number);
  // دمج: سريالات الرصيد + أي سريال مختار حالياً (مثلاً محجوز لهذا المستند)
  const knownSet = new Set(stockSerials.map(s => s.serial_number));
  const extraSelected = selected.filter(s => !knownSet.has(s));
  const allRows = [
    ...stockSerials.map(s => ({ serial_number: s.serial_number, status: s.status })),
    ...extraSelected.map(s => ({ serial_number: s, status: 'selected' }))
  ];

  const toggle = (sn, status) => {
    const isSelected = selected.includes(sn);
    // المحجوز لمستند تاني ميتفتحش
    if (!isSelected && status === 'reserved') return;
    if (isSelected) onChange(selected.filter(x => x !== sn));
    else onChange([...selected, sn]);
  };

  const required = parseInt(count) || 0;
  const isComplete = required > 0 && selected.length === required;
  const availableCount = stockSerials.filter(s => s.status === 'available').length;

  if (!warehouseId) {
    return <div style={{ padding: '10px', background: '#fff3cd', borderRadius: '6px', fontSize: '13px', color: '#856404' }}>⚠️ اختر المخزن الأول عشان تظهر السريالات المتاحة</div>;
  }

  return (
    <div style={{ border: '1px solid #d1d5db', borderRadius: '8px', padding: '10px', background: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#374151' }}>
          🔢 السريالات المتاحة بالمخزن ({availableCount})
        </span>
        <span style={{ fontSize: '12px', fontWeight: 'bold', padding: '2px 10px', borderRadius: '10px', background: isComplete ? '#d1fae5' : '#fee2e2', color: isComplete ? '#065f46' : '#991b1b' }}>
          مختار: {selected.length} / {required}
        </span>
      </div>

      {loading && <div style={{ fontSize: '13px', color: '#6b7280', padding: '8px' }}>⏳ جاري تحميل السريالات...</div>}
      {error && <div style={{ fontSize: '13px', color: '#dc3545', padding: '8px' }}>{error}</div>}
      {!loading && !error && allRows.length === 0 && (
        <div style={{ fontSize: '13px', color: '#991b1b', padding: '8px', background: '#fee2e2', borderRadius: '6px' }}>
          ❌ لا توجد سريالات متاحة لهذا الصنف في هذا المخزن
        </div>
      )}

      {!loading && allRows.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '160px', overflowY: 'auto', direction: 'ltr' }}>
          {allRows.map((row) => {
            const isSelected = selected.includes(row.serial_number);
            const isReservedOther = row.status === 'reserved' && !isSelected;
            return (
              <button
                key={row.serial_number}
                type="button"
                disabled={isReservedOther}
                onClick={() => toggle(row.serial_number, row.status)}
                title={isReservedOther ? 'محجوز لمستند آخر' : (row.status === 'reserved' ? 'محجوز لهذا المستند' : 'متاح')}
                style={{
                  padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace',
                  border: isSelected ? '2px solid #059669' : '1px solid #d1d5db',
                  background: isSelected ? '#d1fae5' : (isReservedOther ? '#f3f4f6' : 'white'),
                  color: isSelected ? '#065f46' : (isReservedOther ? '#9ca3af' : '#374151'),
                  cursor: isReservedOther ? 'not-allowed' : 'pointer',
                  fontWeight: isSelected ? 'bold' : 'normal',
                  textDecoration: isReservedOther ? 'line-through' : 'none'
                }}
              >
                {isSelected ? '✓ ' : ''}{row.serial_number}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SerialPicker;
