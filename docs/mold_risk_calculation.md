# Tutorial: Implementing Mold Risk Calculation

This tutorial outlines the mathematical model and implementation logic for calculating mold growth risk based on environmental sensor data (Temperature and Relative Humidity).

## 1. Define the Environment Variables

Before calculating risk, the system must distinguish between "Favorable" and "Unfavorable" conditions. Mold germination requires a specific window of temperature and moisture.

*   **Temperature ($T$):** $2^\circ\text{C}$ to $45^\circ\text{C}$ ($35.6^\circ\text{F}$ to $113^\circ\text{F}$)
*   **Relative Humidity ($RH$):** Above 65%

## 2. Calculate the Growth Rate

The core of the formula is the **Mold Growth Rate (MGR)**, which is the inverse of the time it takes for mold to germinate under specific conditions.

1.  **Determine Days to Mold (DTM):** Use a lookup table (such as the IPI Dew Point Calculator) to find how many days it takes mold to grow at the current $T$ and $RH$.
2.  **Calculate MGR:**
    $$MGR = \frac{1}{DTM}$$

**Note:** If conditions are unfavorable ($RH < 65\%$ or $T$ is out of range), the MGR for that reading is **0**.

## 3. Calculate the Risk Score (GoRP)

The **Growth over Reading Period (GoRP)** quantifies the risk contributed by a single sensor reading.

**Formula:**
$$GoRP = MGR \times \text{Reading Time (in days)}$$

*Example:* If your sensor records data every 30 minutes, the reading time is $0.0208$ days ($0.5 / 24$).

## 4. Aggregate and Monitor

To find the total **Mold Risk Score**, sum the GoRP values over your desired timeframe (e.g., a week or a month).

### The "Reset" Rule
This is the most critical part of the algorithm for preventing "false positives":
**If conditions remain unfavorable (e.g., $RH < 65\%$) for 24 consecutive hours, the Mold Risk Score must reset to 0.**

## 5. Interpret the Results

Use this table to trigger alerts or actions within your system:

| Mold Risk Score | Status | Action Required |
| :--- | :--- | :--- |
| 0 | None | Maintain current conditions. |
| 0 - 0.50 | Low | Monitor for upward trends. |
| 0.50 - 1.00 | Medium | **Caution:** Inspect the area; improve airflow. |
| 1.0 | High | High probability of germination. |
| > 1.0 | Active | **Critical:** Mold is likely active; immediate intervention. |

## Implementation Pro-Tip: Avoid Aggregation

Do not average the data from multiple sensors. Mold is a "microclimate" issue. One sensor near a cold exterior wall may hit a score of 1.2 (Active), while a sensor in the center of the room stays at 0. **Evaluate each sensor individually** to catch localized outbreaks.
