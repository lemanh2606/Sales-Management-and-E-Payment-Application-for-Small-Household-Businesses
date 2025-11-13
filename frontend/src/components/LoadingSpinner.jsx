// src/components/LoadingSpinner.jsx
import React from "react";
import { Spin } from "antd";
import { LoadingOutlined } from "@ant-design/icons";

/**
 * LoadingSpinner Component - Simple version (không bọc content)
 * 
 * @param {string} size - Size của spinner: 'small' | 'default' | 'large'
 * @param {number} iconSize - Font size của icon spinner
 * @param {string} iconColor - Màu của icon spinner
 * @param {string} tip - Text hiển thị dưới spinner (optional)
 */
const LoadingSpinner = ({
    size = "large",
    iconSize,
    iconColor = "#52c41a",
    tip,
}) => {
    // Auto calculate icon size based on Spin size if not provided
    const calculatedIconSize = iconSize || (
        size === "small" ? 24 :
            size === "large" ? 48 : 32
    );

    return (
        <Spin
            size={size}
            tip={tip}
            indicator={
                <LoadingOutlined
                    style={{
                        fontSize: calculatedIconSize,
                        color: iconColor
                    }}
                    spin
                />
            }
        />
    );
};

export default LoadingSpinner;
