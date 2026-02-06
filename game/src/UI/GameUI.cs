using Godot;
using System;
using GrandStrategyGame.Core;
using GrandStrategyGame.Map;

namespace GrandStrategyGame.UI
{
    public partial class GameUI : CanvasLayer
    {
        private Label _dateLabel;
        private Label _provinceLabel;
        private Label _countryLabel;
        private Button _pauseButton;
        private HSlider _speedSlider;
        
        private MapInteraction _mapInteraction;
        
        public override void _Ready()
        {
            // 获取UI节点
            _dateLabel = GetNode<Label>("Control/TopBar/DateLabel");
            _provinceLabel = GetNode<Label>("Control/BottomPanel/ProvinceLabel");
            _countryLabel = GetNode<Label>("Control/BottomPanel/CountryLabel");
            _pauseButton = GetNode<Button>("Control/TopBar/PauseButton");
            _speedSlider = GetNode<HSlider>("Control/TopBar/SpeedSlider");
            
            _mapInteraction = GetNode<MapInteraction>("../MapInteraction");
            
            // 连接信号
            GameManager.Instance.DateChanged += OnDateChanged;
            _mapInteraction.ProvinceSelected += OnProvinceSelected;
            _mapInteraction.ProvinceHover += OnProvinceHover;
            
            _pauseButton.Pressed += OnPausePressed;
            _speedSlider.ValueChanged += OnSpeedChanged;
            
            // 初始更新
            UpdateDateLabel();
        }
        
        private void OnDateChanged(string newDate)
        {
            UpdateDateLabel();
        }
        
        private void UpdateDateLabel()
        {
            if (_dateLabel != null)
            {
                _dateLabel.Text = GameManager.Instance.GetFormattedDate();
            }
        }
        
        private void OnProvinceSelected(int provinceId)
        {
            if (provinceId < 0 || provinceId >= MapData.PROVINCE_COUNT) return;
            
            var province = MapData.Instance.Provinces[provinceId];
            
            if (_provinceLabel != null)
            {
                _provinceLabel.Text = $"省份: {province.Name}";
            }
            
            if (_countryLabel != null)
            {
                if (province.CountryId >= 0 && province.CountryId < MapData.COUNTRY_COUNT)
                {
                    var country = MapData.Instance.Countries[province.CountryId];
                    _countryLabel.Text = $"国家: {country.Name}";
                }
                else
                {
                    _countryLabel.Text = "国家: 无";
                }
            }
        }
        
        private void OnProvinceHover(int provinceId)
        {
            // 可以在这里显示悬停信息
        }
        
        private void OnPausePressed()
        {
            GameManager.Instance.TogglePause();
            _pauseButton.Text = GameManager.Instance.IsPaused ? "继续" : "暂停";
        }
        
        private void OnSpeedChanged(double value)
        {
            int speed = (int)value;
            GameManager.Instance.SetGameSpeed(speed);
        }
    }
}
