from datetime import date, datetime


def check_data_freshness(data_date, current_date=None, max_lag_days=30):
    if current_date is None:
        current_date = datetime.utcnow()

    if isinstance(data_date, date) and not isinstance(data_date, datetime):
        data_date = datetime.combine(data_date, datetime.min.time())

    lag_days = (current_date - data_date).days
    if lag_days > max_lag_days:
        return f"lagged; release: {data_date.strftime('%Y-%m')}"
    return None
