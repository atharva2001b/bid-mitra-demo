"use client"

import { AppLayout } from "@/components/app-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Building2, Users, Mail, Phone, MapPin, FileText, FileCheck, Shield, CreditCard, File } from "lucide-react"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface Bid {
  bid_id: string
  bid_name: string
  pdf_path: string
}

export default function ContractorIntelligencePage() {
  // Demo data for Abhiraj and Shraddha JV bids
  const contractors = [
    {
      id: "abhiraj",
      name: "ABHIRAJ ENGICON PVT LTD",
      type: "Company",
      bids: [
        {
          bid_id: "demo-abhiraj-1",
          bid_name: "ABHIRAJ ENGICON PVT LTD - Kukadi Project",
          tender_name: "Kukadi Irrigation Project",
          status: "Under Evaluation"
        }
      ],
      details: {
        address: "Flat No.101, Mansi Apartment, Survey No.24, Vishal Nagar, Near Jagtap Dairy, Pimple Nilakh, Pune 411 027",
        email: "abhirajpune@yahoo.com",
        phone: "9422503869",
        registration: "Private Limited Company"
      }
    },
    {
      id: "shraddha-jv",
      name: "ABHIRAJ - SHRADDHA (J.V.)",
      type: "Joint Venture",
      bids: [
        {
          bid_id: "demo-shraddha-jv-1",
          bid_name: "ABHIRAJ - SHRADDHA (J.V.) - Kukadi Project",
          tender_name: "Kukadi Irrigation Project",
          status: "Under Evaluation"
        }
      ],
      details: {
        type: "Partnership",
        leadingFirm: "Abhiraj Engicon Pvt. Ltd.",
        poaHolder: "Mr. Nanasaheb Ishwara Rachkar",
        address: "Flat No. 101, Mansi Apartment, Survey No.24, Vishal Nagar, Near Jagtap Dairy, Pimple Nilakh, Pune - 411 027 (Maharashtra)",
        email: "abhirajpune@yahoo.com",
        phone: "9422503869",
        partners: [
          {
            name: "M/s. Shraddha Constructions",
            share: "40%",
            address: "Near Nagraj Mandir, Main Road Palus, Tal.- Palus, Dist.- Sangli (Maharashtra) - 416 310"
          },
          {
            name: "Abhiraj Engicon Pvt. Ltd.",
            share: "40%",
            address: "Flat No.101, Mansi Apartment, Survey No.24, Vishal Nagar, Near Jagtap Dairy, Pimple Nilakh, Pune 411 027"
          },
          {
            name: "Shankar Sambhaji Jadhav",
            share: "20%",
            address: "1, Sonali, Lane No.-6, Prabhat Road, Pune - 411 004"
          }
        ],
        projectTendered: "Kukadi Irrigation Project, Dist Pune, Ahilyanagar Special Repairs to Kukadi Left Bank Canal k.m.1 to 60 under Maharashtra Irrigation Improvement Programme (MIIP)"
      }
    }
  ]

  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Contractor Intelligence</h1>
          <p className="text-muted-foreground">
            Comprehensive information about contractors and their bids
          </p>
        </div>

        <div className="space-y-6">
          {contractors.map((contractor) => (
            <Card key={contractor.id} className="overflow-hidden">
              <CardHeader className="bg-primary/5 border-b">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl flex items-center gap-2">
                      {contractor.type === "Joint Venture" ? (
                        <Users className="h-6 w-6 text-primary" />
                      ) : (
                        <Building2 className="h-6 w-6 text-primary" />
                      )}
                      {contractor.name}
                    </CardTitle>
                    <Badge className="mt-2" variant={contractor.type === "Joint Venture" ? "default" : "secondary"}>
                      {contractor.type}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Contact Information */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Contact Information
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                        <div>
                          <p className="text-sm font-medium">Address</p>
                          <p className="text-sm text-muted-foreground">{contractor.details.address}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground mt-1" />
                        <div>
                          <p className="text-sm font-medium">Email</p>
                          <p className="text-sm text-muted-foreground">{contractor.details.email}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground mt-1" />
                        <div>
                          <p className="text-sm font-medium">Phone</p>
                          <p className="text-sm text-muted-foreground">{contractor.details.phone}</p>
                        </div>
                      </div>
                      {contractor.type === "Joint Venture" && (
                        <>
                          <div className="mt-4 pt-4 border-t">
                            <p className="text-sm font-medium mb-2">Type</p>
                            <p className="text-sm text-muted-foreground">{contractor.details.type}</p>
                          </div>
                          <div className="mt-3">
                            <p className="text-sm font-medium mb-2">Leading Firm</p>
                            <p className="text-sm text-muted-foreground">{contractor.details.leadingFirm}</p>
                          </div>
                          <div className="mt-3">
                            <p className="text-sm font-medium mb-2">POA Holder / Authorized Signatory</p>
                            <p className="text-sm text-muted-foreground">{contractor.details.poaHolder}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Bids Information */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Bids Submitted
                    </h3>
                    <div className="space-y-3">
                      {contractor.bids.map((bid) => (
                        <Card key={bid.bid_id} className="border">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium">{bid.tender_name}</p>
                                <p className="text-sm text-muted-foreground mt-1">Bid ID: {bid.bid_id}</p>
                              </div>
                              <Badge variant="outline">{bid.status}</Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Government Documents */}
                <div className="mt-6 pt-6 border-t">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Government Documents
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {/* PAN Card */}
                    <Card className="border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 transition-colors">
                      <CardContent className="p-4 flex flex-col items-center justify-center min-h-[120px] text-center">
                        <CreditCard className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">PAN Card</p>
                        <p className="text-xs text-muted-foreground mt-1"></p>
                      </CardContent>
                    </Card>

                    {/* GST Certificate */}
                    <Card className="border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 transition-colors">
                      <CardContent className="p-4 flex flex-col items-center justify-center min-h-[120px] text-center">
                        <FileCheck className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">GST Certificate</p>
                        <p className="text-xs text-muted-foreground mt-1"></p>
                      </CardContent>
                    </Card>

                    {/* Registration Certificate */}
                    <Card className="border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 transition-colors">
                      <CardContent className="p-4 flex flex-col items-center justify-center min-h-[120px] text-center">
                        <File className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">Registration Certificate</p>
                        <p className="text-xs text-muted-foreground mt-1"></p>
                      </CardContent>
                    </Card>

                    {/* Incorporation Certificate */}
                    <Card className="border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 transition-colors">
                      <CardContent className="p-4 flex flex-col items-center justify-center min-h-[120px] text-center">
                        <Shield className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">Incorporation Certificate</p>
                        <p className="text-xs text-muted-foreground mt-1"></p>
                      </CardContent>
                    </Card>

                    {/* MSME Certificate */}
                    <Card className="border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 transition-colors">
                      <CardContent className="p-4 flex flex-col items-center justify-center min-h-[120px] text-center">
                        <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">MSME Certificate</p>
                        <p className="text-xs text-muted-foreground mt-1"></p>
                      </CardContent>
                    </Card>

                    {/* ISO Certificate */}
                    <Card className="border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 transition-colors">
                      <CardContent className="p-4 flex flex-col items-center justify-center min-h-[120px] text-center">
                        <FileCheck className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">ISO Certificate</p>
                        <p className="text-xs text-muted-foreground mt-1"></p>
                      </CardContent>
                    </Card>

                    {/* Bank Statement */}
                    <Card className="border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 transition-colors">
                      <CardContent className="p-4 flex flex-col items-center justify-center min-h-[120px] text-center">
                        <File className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">Bank Statement</p>
                        <p className="text-xs text-muted-foreground mt-1"></p>
                      </CardContent>
                    </Card>

                    {/* Income Tax Return */}
                    <Card className="border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/50 transition-colors">
                      <CardContent className="p-4 flex flex-col items-center justify-center min-h-[120px] text-center">
                        <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm font-medium">Income Tax Return</p>
                        <p className="text-xs text-muted-foreground mt-1"></p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Joint Venture Partners */}
                {contractor.type === "Joint Venture" && contractor.details.partners && (
                  <div className="mt-6 pt-6 border-t">
                    <h3 className="text-lg font-semibold mb-4">Partners and Partnership Share</h3>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Partner Name</TableHead>
                            <TableHead className="w-32">Partnership %</TableHead>
                            <TableHead>Address</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contractor.details.partners.map((partner, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{partner.name}</TableCell>
                              <TableCell>{partner.share}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{partner.address}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Project Tendered For */}
                {contractor.type === "Joint Venture" && contractor.details.projectTendered && (
                  <div className="mt-6 pt-6 border-t">
                    <h3 className="text-lg font-semibold mb-2">Project Tendered For</h3>
                    <p className="text-sm text-muted-foreground">{contractor.details.projectTendered}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}
