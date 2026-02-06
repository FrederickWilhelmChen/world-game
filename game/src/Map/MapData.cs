using Godot;
using System.Collections.Generic;
using System.Linq;

namespace GrandStrategyGame.Map
{
    public partial class MapData : Node
    {
        public static MapData Instance { get; private set; }
        
        public const int MAP_WIDTH = 200;
        public const int MAP_HEIGHT = 150;
        public const int PROVINCE_COUNT = 500;
        public const int COUNTRY_COUNT = 20;
        public const int CELL_SIZE = 8;
        
        public Province[] Provinces { get; private set; }
        public Country[] Countries { get; private set; }
        public int[,] ProvinceGrid { get; private set; }
        public int[,] TerrainGrid { get; private set; }
        
        public override void _Ready()
        {
            Instance = this;
            InitializeArrays();
        }
        
        private void InitializeArrays()
        {
            Provinces = new Province[PROVINCE_COUNT];
            for (int i = 0; i < PROVINCE_COUNT; i++)
            {
                Provinces[i] = new Province(i);
            }
            
            Countries = new Country[COUNTRY_COUNT];
            ProvinceGrid = new int[MAP_WIDTH, MAP_HEIGHT];
            TerrainGrid = new int[MAP_WIDTH, MAP_HEIGHT];
            
            // 初始化为-1表示未分配
            for (int x = 0; x < MAP_WIDTH; x++)
            {
                for (int y = 0; y < MAP_HEIGHT; y++)
                {
                    ProvinceGrid[x, y] = -1;
                }
            }
        }
        
        public Province GetProvinceAt(Vector2I cell)
        {
            if (cell.X < 0 || cell.X >= MAP_WIDTH || cell.Y < 0 || cell.Y >= MAP_HEIGHT)
                return null;
            
            int provId = ProvinceGrid[cell.X, cell.Y];
            if (provId >= 0 && provId < PROVINCE_COUNT)
                return Provinces[provId];
            
            return null;
        }
        
        public List<Province> GetCountryProvinces(int countryId)
        {
            if (countryId < 0 || countryId >= COUNTRY_COUNT)
                return new List<Province>();
            
            return Provinces.Where(p => p.CountryId == countryId).ToList();
        }
        
        public bool AreProvincesAdjacent(int provId1, int provId2)
        {
            if (provId1 < 0 || provId1 >= PROVINCE_COUNT || provId2 < 0 || provId2 >= PROVINCE_COUNT)
                return false;
            
            return Provinces[provId1].Neighbors.Contains(provId2);
        }
        
        public void Reset()
        {
            InitializeArrays();
        }
    }
}
