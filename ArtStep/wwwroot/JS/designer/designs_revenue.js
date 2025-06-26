document.addEventListener('DOMContentLoaded', function () {
    // DOM Elements
    const summaryView = document.getElementById('summary-view');
    const chartView = document.getElementById('chart-view');
    const viewSummaryBtn = document.getElementById('view-summary');
    const viewChartBtn = document.getElementById('view-chart');
    const applyFilterBtn = document.getElementById('apply-filter');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const salesTableBody = document.getElementById('sales-table-body');

    // Chart variables
    let salesChart = null;

    // Set default dates (last 30 days)
    setDefaultDates();

    // Event Listeners
    viewSummaryBtn.addEventListener('click', () => toggleView('summary'));
    viewChartBtn.addEventListener('click', () => toggleView('chart'));
    applyFilterBtn.addEventListener('click', fetchSalesData);

    // Initial data load
    fetchSalesData();

    function setDefaultDates() {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 365);

        endDateInput.valueAsDate = endDate;
        startDateInput.valueAsDate = startDate;
    }

    function toggleView(view) {
        if (view === 'summary') {
            summaryView.style.display = 'block';
            chartView.style.display = 'none';
            viewSummaryBtn.classList.add('active');
            viewChartBtn.classList.remove('active');
        } else {
            summaryView.style.display = 'none';
            chartView.style.display = 'block';
            viewSummaryBtn.classList.remove('active');
            viewChartBtn.classList.add('active');
            // Ensure chart is rendered when switching to chart view
            if (salesChart) {
                salesChart.update();
            }
        }
    }

    async function fetchSalesData() {
        try {
            // Show loading state
            document.querySelector('.loader-wrapper').style.display = 'flex';

            // Get date range
            const startDate = startDateInput.value;
            const endDate = endDateInput.value;
            // Get token từ localStorage hoặc cookie
            const token = localStorage.getItem('token') || getCookie('token');
            // Fetch data from API
            const response = await fetch(`/api/Designer/view_revenue?startDate=${startDate}&endDate=${endDate}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (!response.ok) {
                throw new Error('Failed to fetch sales data');
            }

            const salesData = await response.json();

            // Update UI with the fetched data
            updateSummaryStats(salesData);
            populateSalesTable(salesData);
            renderSalesChart(salesData);

        } catch (error) {
            console.error('Error fetching sales data:', error);
            alert('Could not load sales data. Please try again.');
        } finally {
            // Hide loading state
            document.querySelector('.loader-wrapper').style.display = 'none';
        }
    }

    function updateSummaryStats(data) {
        if (!data || data.length === 0) {
            // Reset stats if no data
            document.getElementById('total-revenue').textContent = '0.00đ';
            document.getElementById('total-sales').textContent = '0';
            document.getElementById('avg-price').textContent = '0.00đ';
            document.getElementById('top-product').textContent = '-';
            return;
        }

        // Calculate summary statistics
        const totalRevenue = data.reduce((sum, item) => sum + (item.PriceAShoe * item.Quantity), 0);
        const totalSales = data.reduce((sum, item) => sum + item.Quantity, 0);
        const avgPrice = totalRevenue / totalSales;

        // Find top product
        const topProduct = data.reduce((top, item) =>
            item.Quantity > top.quantity ? { name: item.ShoeName, quantity: item.Quantity } : top,
            { name: '', quantity: 0 }
        );

        // Update DOM
        document.getElementById('total-revenue').textContent = `${totalRevenue.toFixed(2)}đ`;
        document.getElementById('total-sales').textContent = totalSales;
        document.getElementById('avg-price').textContent = `${avgPrice.toFixed(2)}đ`;
        document.getElementById('top-product').textContent = topProduct.name || '-';
    }

    function populateSalesTable(data) {
        // Clear existing rows
        salesTableBody.innerHTML = '';

        if (!data || data.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="5" class="no-data">No sales data available for the selected period</td>';
            salesTableBody.appendChild(row);
            return;
        }

        // Create and append rows for each sales item
        data.forEach(item => {
            const totalRevenue = item.PriceAShoe * item.Quantity;
            const profitMargin = calculateProfitMargin(item.PriceAShoe); // Implement this based on your business logic

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.ShoeName || 'N/A'}</td>
                <td>${item.Quantity}</td>
                <td>${item.PriceAShoe.toFixed(2)} đ</td>
                <td>${totalRevenue.toFixed(2)} đ</td>
                <td>${profitMargin}%</td>
            `;
            salesTableBody.appendChild(row);
        });
    }

    function renderSalesChart(data) {
        const ctx = document.getElementById('sales-chart').getContext('2d');

        // Prepare chart data
        const labels = data.map(item => item.ShoeName);
        const revenueData = data.map(item => item.PriceAShoe * item.Quantity);
        const quantityData = data.map(item => item.Quantity);

        // Destroy previous chart if it exists
        if (salesChart) {
            salesChart.destroy();
        }

        // Create new chart
        salesChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Revenue ($)',
                        data: revenueData,
                        backgroundColor: 'rgba(54, 162, 235, 0.7)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Quantity Sold',
                        data: quantityData,
                        backgroundColor: 'rgba(255, 99, 132, 0.7)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1,
                        yAxisID: 'y1',
                        type: 'line'
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Sales Performance'
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.dataset.yAxisID === 'y') {
                                    label += '$' + context.parsed.y.toFixed(2);
                                } else {
                                    label += context.parsed.y;
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Revenue ($)'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Quantity Sold'
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                }
            }
        });
    }

    function calculateProfitMargin(price) {
        // Implement your actual profit margin calculation logic here
        // This is just a placeholder example
        const cost = price * 0.6; // Assuming 40% margin
        return ((price - cost) / price * 100).toFixed(1);
    }
});