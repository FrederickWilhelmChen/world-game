using Godot;
using System.Collections.Generic;

namespace GrandStrategyGame.Map
{
    public class Country
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Adjective { get; set; }
        public Color Color { get; set; }
        public int CapitalProvinceId { get; set; } = -1;
        public List<int> OwnedProvinces { get; set; } = new List<int>();
        public GovernmentType Government { get; set; }
        
        public Country(int id, string name, Color color)
        {
            Id = id;
            Name = name;
            Adjective = name;
            Color = color;
        }
    }
}
