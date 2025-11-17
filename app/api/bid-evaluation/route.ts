import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

const DATA_FILE = path.join(process.cwd(), "data", "bid-evaluation-data.json")
const TEMPLATE_FILE = path.join(process.cwd(), "data", "bid-evaluation-template.json")

// GET - Fetch evaluation data
export async function GET() {
  try {
    const fileContent = await fs.readFile(DATA_FILE, "utf-8")
    const data = JSON.parse(fileContent)
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error reading evaluation data:", error)
    return NextResponse.json(
      { error: "Failed to read evaluation data" },
      { status: 500 }
    )
  }
}

// PUT - Update evaluation data
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Update timestamp
    body.updated_at = new Date().toISOString()
    
    // Write to file
    await fs.writeFile(DATA_FILE, JSON.stringify(body, null, 2), "utf-8")
    
    return NextResponse.json({ success: true, data: body })
  } catch (error) {
    console.error("Error updating evaluation data:", error)
    return NextResponse.json(
      { error: "Failed to update evaluation data" },
      { status: 500 }
    )
  }
}

// POST - Reset evaluation data to template or default values
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()
    
    if (action === "reset") {
      // Read template
      const templateContent = await fs.readFile(TEMPLATE_FILE, "utf-8")
      const template = JSON.parse(templateContent)
      
      // Add current timestamp
      template.created_at = new Date().toISOString()
      template.updated_at = new Date().toISOString()
      
      // Write template to data file
      await fs.writeFile(DATA_FILE, JSON.stringify(template, null, 2), "utf-8")
      
      return NextResponse.json({ success: true, message: "Evaluation data reset to template" })
    }
    
    if (action === "resetToDefault") {
      // Read current data to preserve bid_id and tender_id
      let currentData: any = {}
      try {
        const currentContent = await fs.readFile(DATA_FILE, "utf-8")
        currentData = JSON.parse(currentContent)
      } catch (e) {
        // If file doesn't exist, use empty object
      }
      
      // Create default data with correct partner values
      const defaultData = {
        bid_id: currentData.bid_id || "",
        tender_id: currentData.tender_id || "",
        current_selected_criteria: "1",
        current_selected_bidder: "Abhiraj",
        current_pdf_page: 1,
        criterias: {
          "1": {
            metadata: {
              tables: {
                "table-1-Abhiraj": {
                  cells: {
                    "turnover-2019-20": {
                      value: "2343.24",
                      page_number: 111,
                      metadata: {
                        modified_by: "AI",
                        modified_at: new Date().toISOString()
                      }
                    },
                    "turnover-2020-21": {
                      value: "5956.07",
                      page_number: 111,
                      metadata: {
                        modified_by: "AI",
                        modified_at: new Date().toISOString()
                      }
                    },
                    "turnover-2021-22": {
                      value: "1165.00",
                      page_number: 111,
                      metadata: {
                        modified_by: "AI",
                        modified_at: new Date().toISOString()
                      }
                    },
                    "turnover-2022-23": {
                      value: "3814.51",
                      page_number: 111,
                      metadata: {
                        modified_by: "AI",
                        modified_at: new Date().toISOString()
                      }
                    },
                    "turnover-2023-24": {
                      value: "9084.83",
                      page_number: 111,
                      metadata: {
                        modified_by: "AI",
                        modified_at: new Date().toISOString()
                      }
                    }
                  }
                },
                "table-1-Shraddha": {
                  cells: {
                    "turnover-2019-20": {
                      value: "3110.00",
                      page_number: 336,
                      metadata: {
                        modified_by: "AI",
                        modified_at: new Date().toISOString()
                      }
                    },
                    "turnover-2020-21": {
                      value: "2668.86",
                      page_number: 336,
                      metadata: {
                        modified_by: "AI",
                        modified_at: new Date().toISOString()
                      }
                    },
                    "turnover-2021-22": {
                      value: "3491.45",
                      page_number: 336,
                      metadata: {
                        modified_by: "AI",
                        modified_at: new Date().toISOString()
                      }
                    },
                    "turnover-2022-23": {
                      value: "4025.35",
                      page_number: 336,
                      metadata: {
                        modified_by: "AI",
                        modified_at: new Date().toISOString()
                      }
                    },
                    "turnover-2023-24": {
                      value: "7520.72",
                      page_number: 336,
                      metadata: {
                        modified_by: "AI",
                        modified_at: new Date().toISOString()
                      }
                    }
                  }
                },
                "table-1-Shankar": {
                  cells: {
                    "turnover-2019-20": {
                      value: "889.43",
                      page_number: 808,
                      metadata: {
                        modified_by: "AI",
                        modified_at: new Date().toISOString()
                      }
                    },
                    "turnover-2020-21": {
                      value: "1341.21",
                      page_number: 808,
                      metadata: {
                        modified_by: "AI",
                        modified_at: new Date().toISOString()
                      }
                    },
                    "turnover-2021-22": {
                      value: "2047.84",
                      page_number: 808,
                      metadata: {
                        modified_by: "AI",
                        modified_at: new Date().toISOString()
                      }
                    },
                    "turnover-2022-23": {
                      value: "1818.74",
                      page_number: 808,
                      metadata: {
                        modified_by: "AI",
                        modified_at: new Date().toISOString()
                      }
                    },
                    "turnover-2023-24": {
                      value: "1600.00",
                      page_number: 808,
                      metadata: {
                        modified_by: "AI",
                        modified_at: new Date().toISOString()
                      }
                    }
                  }
                },
                "table-1-J.V.": {
                  cells: {
                    "multiplyingFactor-2019-20": {
                      value: "1.50",
                      page_number: 111,
                      metadata: {
                        modified_by: "AI",
                        modified_at: new Date().toISOString()
                      }
                    },
                    "multiplyingFactor-2020-21": {
                      value: "1.40",
                      page_number: 111,
                      metadata: {
                        modified_by: "AI",
                        modified_at: new Date().toISOString()
                      }
                    },
                    "multiplyingFactor-2021-22": {
                      value: "1.30",
                      page_number: 111,
                      metadata: {
                        modified_by: "AI",
                        modified_at: new Date().toISOString()
                      }
                    },
                    "multiplyingFactor-2022-23": {
                      value: "1.20",
                      page_number: 111,
                      metadata: {
                        modified_by: "AI",
                        modified_at: new Date().toISOString()
                      }
                    },
                    "multiplyingFactor-2023-24": {
                      value: "1.10",
                      page_number: 111,
                      metadata: {
                        modified_by: "AI",
                        modified_at: new Date().toISOString()
                      }
                    }
                  }
                }
              }
            }
          }
        },
        bookmarked_pages: currentData.bookmarked_pages || [],
        chat_messages: currentData.chat_messages || [],
        created_at: currentData.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      // Write default data to file
      await fs.writeFile(DATA_FILE, JSON.stringify(defaultData, null, 2), "utf-8")
      
      return NextResponse.json({ success: true, message: "Evaluation data reset to default correct values" })
    }
    
    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    )
  } catch (error) {
    console.error("Error resetting evaluation data:", error)
    return NextResponse.json(
      { error: "Failed to reset evaluation data" },
      { status: 500 }
    )
  }
}





