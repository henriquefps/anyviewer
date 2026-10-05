using System;
using System.Collections.Generic;
using System.Linq;

namespace AtlanticCeramics.Orders
{
    /// <summary>Prices and validates customer orders.</summary>
    public sealed class OrderService
    {
        private const decimal VatRate = 0.23m;
        private readonly IDictionary<string, decimal> _prices;

        public OrderService(IDictionary<string, decimal> prices) =>
            _prices = prices ?? throw new ArgumentNullException(nameof(prices));

        public decimal Total(IEnumerable<OrderLine> lines, bool includeVat = true)
        {
            var net = lines.Sum(l => _prices[l.Sku] * l.SquareMetres);
            return Math.Round(includeVat ? net * (1 + VatRate) : net, 2);
        }

        public IReadOnlyList<string> Validate(IEnumerable<OrderLine> lines)
        {
            var errors = new List<string>();
            foreach (var line in lines)
            {
                if (!_prices.ContainsKey(line.Sku)) errors.Add($"Unknown SKU {line.Sku}");
                if (line.SquareMetres <= 0) errors.Add($"Quantity must be positive for {line.Sku}");
            }
            return errors;
        }
    }

    public record OrderLine(string Sku, decimal SquareMetres);
}
