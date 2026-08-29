import { useState, useEffect } from 'react';
import api from '../services/api';

function ExpenseReport() {
  const [reportData, setReportData] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [custodyCategories, setCustodyCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showDetail, setShowDetail] = useState(false);

  const [filters, setFilters] = useState({
    from_date: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    to_date: new Date().toISOString().split('T')[0],
    selected_expenses: [],
    selected_custody: []
  });

  // Load categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await api.get('/expense-reports/expenses');

      if (response.data && response.data.success) {
        const regular = response.data.regular_expenses || [];
        const custody = response.data.custody_expenses || [];

        setExpenseCategories(regular);
        setCustodyCategories(custody);

        // Select all by default
        const allExpenseIds = [];
        regular.forEach(parent => {
          (parent.sub_categories || []).forEach(sub => {
            if (sub.id) allExpenseIds.push(sub.id);
          });
        });

        const allCustodyIds = [];
        custody.forEach(parent => {
          (parent.sub_categories || []).forEach(sub => {
            if (sub.id) allCustodyIds.push(sub.id);
          });
        });

        setFilters(prev => ({
          ...prev,
          selected_expenses: allExpenseIds,
          selected_custody: allCustodyIds
        }));

        setMessage('');
      } else {
        setMessage('لا توجد مصاريف متاحة حالياً');
      }
    } catch (err) {
      console.error('Error loading categories:', err);
      setMessage('خطأ في تحميل المصاريف: ' + (err.response?.data?.message || err.message || 'خطأ في الاتصال'));
    } finally {
      setLoading(false);
    }
  };

  // Toggle parent checkbox (select/deselect all children)
  const toggleParent = (items, selected, setSelected) => {
    const childIds = (items || []).map(c => c.id).filter(id => id);
    if (childIds.length === 0) return;

    const allSelected = childIds.every(id => selected.includes(id));

    if (allSelected) {
      setSelected(selected.filter(id => !childIds.includes(id)));
    } else {
      setSelected([...new Set([...selected, ...childIds])]);
    }
  };

  // Toggle single child checkbox
  const toggleChild = (id, selected, setSelected) => {
    if (!id) return;
    if (selected.includes(id)) {
      setSelected(selected.filter(i => i !== id));
    } else {
      setSelected([...selected, id]);
    }
  };

  // Check if all children of a parent are selected
  const isParentSelected = (items, selected) => {
    if (!items || items.length === 0) return false;
    const childIds = items.map(c => c.id).filter(id => id);
    if (childIds.length === 0) return false;
    return childIds.every(id => selected.includes(id));
  };

  // Check if some children are selected (for indeterminate state)
  const isParentPartial = (items, selected) => {
    if (!items || items.length === 0) return false;
    const childIds = items.map(c => c.id).filter(id => id);
    if (childIds.length === 0) return false;
    const selectedCount = childIds.filter(id => selected.includes(id)).length;
    return selectedCount > 0 && selectedCount < childIds.length;
  };

  // Generate report
  const fetchReport = async () => {
    if (filters.selected_expenses.length === 0 && filters.selected_custody.length === 0) {
      setMessage('يرجى اختيار مصروف واحد على الأقل');
      return;
    }

    setLoading(true);
    setMessage('');
    setShowDetail(false);
    try {
      const params = new URLSearchParams({
        from_date: filters.from_date,
        to_date: filters.to_date,
        expense_ids: filters.selected_expenses.join(','),
        custody_ids: filters.selected_custody.join(',')
      });

      const response = await api.get(`/expense-reports/pivot?${params}`);
      if (response.data && response.data.success) {
        setReportData(response.data);
      } else {
        setMessage(response.data?.message || 'حدث خطأ في تحميل التقرير');
      }
    } catch (err) {
      console.error('Report error:', err);
      setMessage('خطأ: ' + (err.response?.data?.message || err.message || 'حدث خطأ'));
    } finally {
      setLoading(false);
    }
  };

  // Fetch detail when clicking on a cell
  const fetchDetail = async (costCenterId, childId, sourceType, childName) => {
    if (!costCenterId || !childId) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        from_date: filters.from_date,
        to_date: filters.to_date,
        cost_center_id: costCenterId,
        child_id: childId,
        source_type: sourceType
      });

      const response = await api.get(`/expense-reports/detail?${params}`);
      const ccName = reportData?.cost_centers?.find(c => c.id == costCenterId)?.center_name || '';
      setDetailData({ 
        ...response.data, 
        name: childName, 
        costCenterName: ccName 
      });
      setShowDetail(true);
    } catch (err) {
      console.error('Detail error:', err);
      setMessage('خطأ في تحميل التفاصيل: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Styles
  const thStyle = { 
    padding: '12px', 
    border: '1px solid #2d3748', 
    backgroundColor: '#4a5568', 
    color: 'white', 
    textAlign: 'center', 
    fontWeight: 'bold',
    fontSize: '13px'
  };
  const tdStyle = { 
    padding: '10px', 
    border: '1px solid #cbd5e0', 
    textAlign: 'center',
    fontSize: '13px'
  };
  const tdRight = { 
    padding: '10px', 
    border: '1px solid #cbd5e0', 
    textAlign: 'right',
    fontSize: '13px'
  };
  const parentRowStyle = { 
    backgroundColor: '#edf2f7', 
    fontWeight: 'bold',
    color: '#2d3748'
  };
  const childRowStyle = { 
    backgroundColor: 'white',
    color: '#4a5568'
  };
  const totalRowStyle = { 
    backgroundColor: '#2d3748', 
    color: 'white', 
    fontWeight: 'bold',
    fontSize: '14px'
  };

  // Build pivot structure for display
  const buildPivot = () => {
    if (!reportData || !reportData.pivot) return { rows: [], ccTotals: {}, grandTotal: 0 };

    const rows = [];
    const ccTotals = {};
    let grandTotal = 0;

    // Group by parent_id and source_type
    const groups = {};
    (reportData.pivot || []).forEach(p => {
      const key = `${p.parent_id}_${p.source_type}`;
      if (!groups[key]) {
        groups[key] = {
          parent_id: p.parent_id,
          parent_name: p.parent_name || 'غير مسمى',
          parent_code: p.parent_code || '',
          source_type: p.source_type,
          children: {}
        };
      }
      const childKey = p.child_id;
      if (!groups[key].children[childKey]) {
        groups[key].children[childKey] = {
          child_id: p.child_id,
          child_name: p.child_name || 'غير مسمى',
          child_code: p.child_code || '',
          data: {}
        };
      }
      groups[key].children[childKey].data[p.cost_center_id] = 
        (groups[key].children[childKey].data[p.cost_center_id] || 0) + parseFloat(p.total_amount || 0);
    });

    Object.values(groups).forEach(group => {
      // Parent row
      const parentRow = {
        type: 'parent',
        name: group.parent_name + (group.source_type === 'custody' ? ' (تسوية عهدة)' : ''),
        parent_id: group.parent_id,
        source_type: group.source_type,
        data: {}
      };

      (reportData.cost_centers || []).forEach(cc => {
        let ccTotal = 0;
        Object.values(group.children).forEach(child => {
          ccTotal += child.data[cc.id] || 0;
        });
        parentRow.data[cc.id] = ccTotal;
        ccTotals[cc.id] = (ccTotals[cc.id] || 0) + ccTotal;
      });

      parentRow.total = Object.values(parentRow.data).reduce((a, b) => a + b, 0);
      grandTotal += parentRow.total;
      rows.push(parentRow);

      // Child rows
      Object.values(group.children).forEach(child => {
        const childRow = {
          type: 'child',
          name: child.child_name,
          child_id: child.child_id,
          source_type: group.source_type,
          data: child.data
        };
        childRow.total = Object.values(child.data).reduce((a, b) => a + b, 0);
        rows.push(childRow);
      });
    });

    return { rows, ccTotals, grandTotal };
  };

  const { rows, ccTotals, grandTotal } = buildPivot();

  return (
    <div style={{ padding: '20px', maxWidth: '1600px', margin: '0 auto', direction: 'rtl' }}>
      <h1 style={{ color: '#1565c0', marginBottom: '20px' }}>📊 تقرير المصاريف - تحليلي</h1>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={() => window.location.href = '/treasury-module'} 
          style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
        >
          ← رجوع للخزينة
        </button>
        <button 
          onClick={handlePrint} 
          style={{ padding: '10px 20px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
        >
          🖨️ طباعة
        </button>
      </div>

      {/* Filters Section */}
      <div style={{ color: '#1e293b', backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '12px', marginBottom: '20px', border: '2px solid #dee2e6' }}>
        <h3 style={{ marginTop: 0, color: '#333' }}>فلاتر التقرير</h3>

        {/* Date Range */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>من تاريخ:</label>
            <input 
              type="date" 
              value={filters.from_date} 
              onChange={(e) => setFilters({...filters, from_date: e.target.value})} 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>إلى تاريخ:</label>
            <input 
              type="date" 
              value={filters.to_date} 
              onChange={(e) => setFilters({...filters, to_date: e.target.value})} 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} 
            />
          </div>
        </div>

        {/* Regular Expenses Selection */}
        {expenseCategories.length > 0 && (
          <div style={{ color: '#1e293b', marginBottom: '20px', padding: '15px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #ddd' }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#1565c0' }}>☑️ المصاريف العادية:</h4>

            {expenseCategories.map(parent => (
              <div key={parent.parent_id || parent.id} style={{ marginBottom: '15px' }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  cursor: 'pointer',
                  padding: '10px 15px',
                  backgroundColor: '#e2e8f0',
                  borderRadius: '8px',
                  marginBottom: '10px',
                  fontWeight: 'bold',
                  color: '#2d3748'
                }}>
                  <input 
                    type="checkbox" 
                    checked={isParentSelected(parent.sub_categories, filters.selected_expenses)}
                    ref={el => { if (el) el.indeterminate = isParentPartial(parent.sub_categories, filters.selected_expenses); }}
                    onChange={() => toggleParent(parent.sub_categories, filters.selected_expenses, 
                      (newSelected) => setFilters(prev => ({...prev, selected_expenses: newSelected})))}
                  />
                  {parent.parent_code || parent.code} - {parent.parent_name || parent.name}
                </label>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginRight: '30px' }}>
                  {(parent.sub_categories || []).map(child => (
                    <label key={child.id} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '5px', 
                      cursor: 'pointer', 
                      padding: '8px 15px', 
                      backgroundColor: filters.selected_expenses.includes(child.id) ? '#c6f6d5' : '#f7fafc',
                      borderRadius: '6px',
                      border: filters.selected_expenses.includes(child.id) ? '2px solid #48bb78' : '1px solid #e2e8f0',
                      transition: 'all 0.2s'
                    }}>
                      <input 
                        type="checkbox" 
                        checked={filters.selected_expenses.includes(child.id)}
                        onChange={() => toggleChild(child.id, filters.selected_expenses,
                          (newSelected) => setFilters(prev => ({...prev, selected_expenses: newSelected})))}
                      />
                      <span style={{ fontSize: '13px' }}>{child.code || child.id} - {child.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Custody Settlements Selection */}
        {custodyCategories.length > 0 && (
          <div style={{ color: '#1e293b', marginBottom: '20px', padding: '15px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #ddd' }}>
            <h4 style={{ margin: '0 0 15px 0', color: '#c05621' }}>☑️ تسوية العهدة:</h4>

            {custodyCategories.map(parent => (
              <div key={`custody-${parent.parent_id || parent.id}`} style={{ marginBottom: '15px' }}>
                <label style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  cursor: 'pointer',
                  padding: '10px 15px',
                  backgroundColor: '#fff5eb',
                  borderRadius: '8px',
                  marginBottom: '10px',
                  fontWeight: 'bold',
                  color: '#744210'
                }}>
                  <input 
                    type="checkbox" 
                    checked={isParentSelected(parent.sub_categories, filters.selected_custody)}
                    ref={el => { if (el) el.indeterminate = isParentPartial(parent.sub_categories, filters.selected_custody); }}
                    onChange={() => toggleParent(parent.sub_categories, filters.selected_custody,
                      (newSelected) => setFilters(prev => ({...prev, selected_custody: newSelected})))}
                  />
                  {parent.parent_code || parent.code} - {parent.parent_name || parent.name}
                </label>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginRight: '30px' }}>
                  {(parent.sub_categories || []).map(child => (
                    <label key={child.id} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '5px', 
                      cursor: 'pointer', 
                      padding: '8px 15px', 
                      backgroundColor: filters.selected_custody.includes(child.id) ? '#feebc8' : '#f7fafc',
                      borderRadius: '6px',
                      border: filters.selected_custody.includes(child.id) ? '2px solid #ed8936' : '1px solid #e2e8f0',
                      transition: 'all 0.2s'
                    }}>
                      <input 
                        type="checkbox" 
                        checked={filters.selected_custody.includes(child.id)}
                        onChange={() => toggleChild(child.id, filters.selected_custody,
                          (newSelected) => setFilters(prev => ({...prev, selected_custody: newSelected})))}
                      />
                      <span style={{ fontSize: '13px' }}>{child.code || child.id} - {child.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Generate Button */}
        <button 
          onClick={fetchReport} 
          disabled={loading}
          style={{ 
            padding: '14px 50px', 
            backgroundColor: '#28a745', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px', 
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? '⏳ جاري التحميل...' : '👁️ عرض التقرير'}
        </button>
      </div>

      {message && (
        <div style={{ 
          padding: '15px', 
          backgroundColor: message.includes('خطأ') ? '#f8d7da' : '#fff3cd', 
          color: message.includes('خطأ') ? '#721c24' : '#856404', 
          borderRadius: '8px', 
          marginBottom: '20px' 
        }}>
          {message.includes('خطأ') ? '⚠️ ' : 'ℹ️ '}{message}
        </div>
      )}

      {/* Report Results */}
      {reportData && !showDetail && (
        <div>
          {/* Header */}
          <div style={{ color: '#1e293b', textAlign: 'center', marginBottom: '20px', padding: '20px', backgroundColor: '#e3f2fd', borderRadius: '12px' }}>
            <h2 style={{ margin: '0 0 10px 0', color: '#1565c0' }}>📋 تقرير المصاريف التحليلي</h2>
            <p style={{ color: '#666', marginBottom: '15px' }}>
              الفترة من: <strong>{reportData.from_date}</strong> إلى: <strong>{reportData.to_date}</strong>
            </p>
            <p style={{ fontSize: '24px', color: '#1565c0', margin: 0 }}>
              💰 الاجمالي الكلي: <strong>{grandTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م</strong>
            </p>
          </div>

          {/* Pivot Table */}
          {rows.length > 0 ? (
            <div style={{ overflowX: 'auto', marginBottom: '30px' }}>
              <table style={{ color: '#1e293b', width: '100%', borderCollapse: 'collapse', fontSize: '13px', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden' }}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, minWidth: '300px', textAlign: 'right' }}>المصاريف / مراكز التكلفة</th>
                    {(reportData.cost_centers || []).map(cc => (
                      <th key={cc.id} style={thStyle}>{cc.center_name || cc.name || cc.code}</th>
                    ))}
                    <th style={{ ...thStyle, minWidth: '120px' }}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={idx} style={row.type === 'parent' ? parentRowStyle : childRowStyle}>
                      <td style={{ 
                        ...tdRight, 
                        paddingLeft: row.type === 'child' ? '50px' : '15px',
                        fontWeight: row.type === 'parent' ? 'bold' : 'normal',
                        color: row.type === 'parent' ? '#2d3748' : '#4a5568'
                      }}>
                        {row.type === 'parent' ? (
                          <strong>{row.name}</strong>
                        ) : (
                          <span>└─ {row.name}</span>
                        )}
                      </td>
                      {(reportData.cost_centers || []).map(cc => {
                        const value = row.data[cc.id] || 0;
                        return (
                          <td key={cc.id} style={tdStyle}>
                            {value > 0 ? (
                              <span 
                                onClick={() => {
                                  if (row.type === 'child') {
                                    fetchDetail(cc.id, row.child_id, row.source_type, row.name);
                                  }
                                }}
                                style={{ 
                                  cursor: row.type === 'child' ? 'pointer' : 'default',
                                  color: row.type === 'child' ? '#1565c0' : '#2d3748',
                                  textDecoration: row.type === 'child' ? 'underline' : 'none',
                                  fontWeight: row.type === 'parent' ? 'bold' : 'normal'
                                }}
                                title={row.type === 'child' ? 'اضغط للتفاصيل' : ''}
                              >
                                {value.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </span>
                            ) : (
                              <span style={{ color: '#ccc' }}>-</span>
                            )}
                          </td>
                        );
                      })}
                      <td style={{ ...tdStyle, fontWeight: 'bold', backgroundColor: row.type === 'parent' ? '#cbd5e0' : '#f7fafc' }}>
                        {row.total > 0 ? row.total.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={totalRowStyle}>
                    <td style={{ ...tdRight, padding: '15px' }}>إجمالي مراكز التكلفة</td>
                    {(reportData.cost_centers || []).map(cc => (
                      <td key={cc.id} style={{ ...tdStyle, padding: '15px' }}>
                        {(ccTotals[cc.id] || 0).toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                    ))}
                    <td style={{ ...tdStyle, padding: '15px', fontSize: '16px' }}>
                      {grandTotal.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div style={{ color: '#1e293b', textAlign: 'center', padding: '40px', backgroundColor: '#f8f9fa', borderRadius: '12px' }}>
              <p style={{ fontSize: '18px', color: '#666' }}>لا توجد بيانات للفترة المحددة</p>
            </div>
          )}
        </div>
      )}

      {/* Detail View */}
      {showDetail && detailData && (
        <div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button 
              onClick={() => setShowDetail(false)} 
              style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
            >
              ← رجوع للتقرير
            </button>
          </div>

          <div style={{ color: '#1e293b', textAlign: 'center', marginBottom: '20px', padding: '20px', backgroundColor: '#fff3e0', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#e65100' }}>📑 تفصيلي: {detailData.name}</h3>
            <p style={{ color: '#666', marginBottom: '15px' }}>
              مركز التكلفة: <strong>{detailData.costCenterName || ''}</strong>
            </p>
            <p style={{ fontSize: '22px', color: '#e65100', margin: 0 }}>
              💰 الاجمالي: <strong>{(detailData.total || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م</strong>
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ color: '#1e293b', width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden' }}>
              <thead>
                <tr style={{ backgroundColor: '#4a5568', color: 'white' }}>
                  <th style={thStyle}>م</th>
                  <th style={thStyle}>التاريخ</th>
                  <th style={thStyle}>رقم السند</th>
                  <th style={{ ...thStyle, minWidth: '300px' }}>البيان</th>
                  <th style={thStyle}>النوع</th>
                  <th style={thStyle}>المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {(detailData.data || []).map((row, idx) => (
                  <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#f8f9fa' : 'white' }}>
                    <td style={tdStyle}>{idx + 1}</td>
                    <td style={tdStyle}>
                      {row.transaction_date ? new Date(row.transaction_date).toLocaleDateString('ar-EG') : '-'}
                    </td>
                    <td style={tdStyle}>{row.transaction_number || '-'}</td>
                    <td style={tdRight}>{row.description || row.child_name || '-'}</td>
                    <td style={tdStyle}>
                      {row.source_type === 'تسوية عهدة' ? (
                        <span style={{ 
                          padding: '4px 12px', 
                          borderRadius: '12px', 
                          fontSize: '12px',
                          backgroundColor: '#fff3cd',
                          color: '#856404'
                        }}>
                          🟠 تسوية عهدة {row.employee_name ? `(${row.employee_name})` : ''}
                        </span>
                      ) : (
                        <span style={{ 
                          padding: '4px 12px', 
                          borderRadius: '12px', 
                          fontSize: '12px',
                          backgroundColor: '#d4edda',
                          color: '#155724'
                        }}>
                          🟢 مصروف عادي
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 'bold' }}>
                      {parseFloat(row.amount || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#e65100', color: 'white', fontWeight: 'bold' }}>
                  <td colSpan="5" style={{ ...tdStyle, padding: '15px' }}>الإجمالي</td>
                  <td style={{ ...tdStyle, padding: '15px', fontSize: '16px' }}>
                    {(detailData.total || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExpenseReport;
