import './DataTable.css'

const DataTable = ({ columns, data, onRowClick, actions }) => {
  const getStatusDot = (status) => {
    if (status === 'online') {
      return <div className="data-table__status-dot data-table__status-dot--online" />
    } else if (status === 'warning') {
      return <div className="data-table__status-dot data-table__status-dot--warning" />
    } else {
      return <div className="data-table__status-dot data-table__status-dot--offline" />
    }
  }

  return (
    <div className="data-table">
      <table className="data-table__table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={`data-table__header data-table__col--${column.key}`}
                style={{ textAlign: column.align || 'left' }}
              >
                {column.label}
              </th>
            ))}
            {actions && <th className="data-table__header data-table__header--actions" />}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0)} className="data-table__empty">
                No data available
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={row.id || index}
                className="data-table__row"
                onClick={() => onRowClick && onRowClick(row)}
              >
                {columns.map((column) => {
                  const cellValue = column.render
                    ? column.render(row[column.key], row)
                    : row[column.key]

                  if (column.key === 'status') {
                    return (
                      <td key={column.key} className="data-table__cell data-table__cell--status data-table__col--status">
                        {getStatusDot(cellValue)}
                      </td>
                    )
                  }

                  return (
                    <td
                      key={column.key}
                      className={`data-table__cell data-table__col--${column.key}${column.key === 'name' ? ' data-table__cell--name' : ''}`}
                      style={{ textAlign: column.align || 'left' }}
                    >
                      {cellValue}
                    </td>
                  )
                })}
                {actions && actions.render && (
                  <td className="data-table__cell data-table__cell--actions">
                    {actions.render(row)}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable
