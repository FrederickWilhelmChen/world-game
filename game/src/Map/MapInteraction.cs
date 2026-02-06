using Godot;

namespace GrandStrategyGame.Map
{
    public partial class MapInteraction : Node2D
    {
        [Signal]
        public delegate void ProvinceSelectedEventHandler(int provinceId);
        
        [Signal]
        public delegate void ProvinceHoverEventHandler(int provinceId);
        
        private int _hoveredProvince = -1;
        private int _selectedProvince = -1;
        private MapRenderer _mapRenderer;
        private Color _selectionColor = new Color(1.0f, 1.0f, 0.5f, 0.8f);
        private Color _hoverColor = new Color(1.0f, 1.0f, 1.0f, 0.5f);
        
        public override void _Ready()
        {
            _mapRenderer = GetNode<MapRenderer>("../MapRenderer");
        }
        
        public override void _Input(InputEvent @event)
        {
            if (@event is InputEventMouseButton mouseButton && mouseButton.Pressed)
            {
                if (mouseButton.ButtonIndex == MouseButton.Left)
                {
                    Vector2I cell = GetCellAtMouse();
                    Province province = MapData.Instance.GetProvinceAt(cell);
                    
                    if (province != null)
                    {
                        if (province.Id != _selectedProvince)
                        {
                            // 恢复之前的选中省份
                            if (_selectedProvince >= 0)
                            {
                                _mapRenderer.ResetProvinceColor(_selectedProvince);
                            }
                            
                            _selectedProvince = province.Id;
                            _mapRenderer.HighlightProvince(_selectedProvince, _selectionColor);
                            
                            EmitSignal(SignalName.ProvinceSelected, _selectedProvince);
                            GD.Print($"Selected province: {province.Name} (Country: {province.CountryId})");
                        }
                    }
                }
            }
            
            if (@event is InputEventMouseMotion)
            {
                UpdateHover();
            }
        }
        
        private void UpdateHover()
        {
            Vector2I cell = GetCellAtMouse();
            Province province = MapData.Instance.GetProvinceAt(cell);
            
            int newHoverId = province?.Id ?? -1;
            
            if (newHoverId != _hoveredProvince)
            {
                // 恢复之前的hover省份
                if (_hoveredProvince >= 0 && _hoveredProvince != _selectedProvince)
                {
                    _mapRenderer.ResetProvinceColor(_hoveredProvince);
                }
                
                _hoveredProvince = newHoverId;
                
                // 高亮新的hover省份
                if (_hoveredProvince >= 0 && _hoveredProvince != _selectedProvince)
                {
                    _mapRenderer.HighlightProvince(_hoveredProvince, _hoverColor);
                }
                
                EmitSignal(SignalName.ProvinceHover, _hoveredProvince);
            }
        }
        
        private Vector2I GetCellAtMouse()
        {
            Vector2 mousePos = GetGlobalMousePosition();
            return new Vector2I(
                (int)(mousePos.X / MapData.CELL_SIZE),
                (int)(mousePos.Y / MapData.CELL_SIZE)
            );
        }
        
        public int GetSelectedProvince()
        {
            return _selectedProvince;
        }
        
        public int GetHoveredProvince()
        {
            return _hoveredProvince;
        }
    }
}
