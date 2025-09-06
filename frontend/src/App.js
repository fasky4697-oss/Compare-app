import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { Textarea } from "./components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Badge } from "./components/ui/badge";
import { Separator } from "./components/ui/separator";
import { Alert, AlertDescription } from "./components/ui/alert";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { AlertCircle, Plus, Trash2, Calculator, Download, TrendingUp } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// ชื่อเทคนิคที่พร้อมใช้งาน
const AVAILABLE_TECHNIQUES = [
  "qPCR", "RPA", "LAMP", "PCR", "NASBA", "TMA", "SDA", "NEAR", "HDA", "RT-PCR"
];

const App = () => {
  const [activeTab, setActiveTab] = useState("input");
  const [experiments, setExperiments] = useState([]);
  const [currentExperiment, setCurrentExperiment] = useState({
    experiment_name: "",
    description: "",
    techniques: []
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  // เพิ่มเทคนิคใหม่
  const addTechnique = () => {
    setCurrentExperiment(prev => ({
      ...prev,
      techniques: [...prev.techniques, {
        technique_name: "",
        matrix: {
          true_positive: 0,
          false_positive: 0,
          true_negative: 0,
          false_negative: 0
        },
        confidence_level: 0.95
      }]
    }));
  };

  // ลบเทคนิค
  const removeTechnique = (index) => {
    setCurrentExperiment(prev => ({
      ...prev,
      techniques: prev.techniques.filter((_, i) => i !== index)
    }));
  };

  // อัพเดทข้อมูลเทคนิค
  const updateTechnique = (index, field, value) => {
    setCurrentExperiment(prev => ({
      ...prev,
      techniques: prev.techniques.map((tech, i) => 
        i === index ? { ...tech, [field]: value } : tech
      )
    }));
  };

  // อัพเดทข้อมูล confusion matrix
  const updateMatrix = (techniqueIndex, field, value) => {
    setCurrentExperiment(prev => ({
      ...prev,
      techniques: prev.techniques.map((tech, i) => 
        i === techniqueIndex ? {
          ...tech,
          matrix: { ...tech.matrix, [field]: parseInt(value) || 0 }
        } : tech
      )
    }));
  };

  // ส่งข้อมูลการทดลอง
  const submitExperiment = async () => {
    if (!currentExperiment.experiment_name.trim()) {
      alert("กรุณาใส่ชื่อการทดลอง");
      return;
    }

    if (currentExperiment.techniques.length < 2) {
      alert("กรุณาเพิ่มข้อมูลอย่างน้อย 2 เทคนิค");
      return;
    }

    for (let tech of currentExperiment.techniques) {
      if (!tech.technique_name.trim()) {
        alert("กรุณาเลือกชื่อเทคนิคให้ครบทุกรายการ");
        return;
      }
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/experiments`, currentExperiment);
      setResults(response.data);
      setActiveTab("results");
      loadExperiments();
    } catch (error) {
      console.error("Error:", error);
      alert("เกิดข้อผิดพลาดในการคำนวณ: " + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  // โหลดรายการการทดลอง
  const loadExperiments = async () => {
    try {
      const response = await axios.get(`${API}/experiments`);
      setExperiments(response.data);
    } catch (error) {
      console.error("Error loading experiments:", error);
    }
  };

  useEffect(() => {
    loadExperiments();
  }, []);

  // ฟังก์ชันสำหรับสร้างข้อมูลกราฟ
  const prepareChartData = () => {
    if (!results) return [];
    
    return results.techniques_results.map(tech => ({
      name: tech.technique_name,
      sensitivity: (tech.stats.sensitivity * 100).toFixed(1),
      specificity: (tech.stats.specificity * 100).toFixed(1),
      ppv: (tech.stats.ppv * 100).toFixed(1),
      npv: (tech.stats.npv * 100).toFixed(1),
      accuracy: (tech.stats.accuracy * 100).toFixed(1),
      kappa: (tech.cohen_kappa * 100).toFixed(1)
    }));
  };

  // ข้อมูลสำหรับ Radar Chart
  const prepareRadarData = () => {
    if (!results) return [];
    
    // Create array of metrics for radar chart
    const metrics = ['Sensitivity', 'Specificity', 'Accuracy', 'Kappa'];
    
    return metrics.map(metric => {
      const data = { metric };
      results.techniques_results.forEach(tech => {
        let value = 0;
        switch (metric) {
          case 'Sensitivity':
            value = tech.stats.sensitivity * 100;
            break;
          case 'Specificity':
            value = tech.stats.specificity * 100;
            break;
          case 'Accuracy':
            value = tech.stats.accuracy * 100;
            break;
          case 'Kappa':
            value = tech.cohen_kappa * 100;
            break;
        }
        data[tech.technique_name] = value;
      });
      return data;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🧬 แอปพลิเคชันเปรียบเทียบเทคนิคการเพิ่มปริมาณกรดนิวคลีอิก
          </h1>
          <p className="text-lg text-gray-600">
            เครื่องมือสำหรับการวิเคราะห์และเปรียบเทียบประสิทธิภาพของเทคนิค qPCR, RPA, LAMP และอื่นๆ
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="input" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              ป้อนข้อมูล
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              ผลลัพธ์
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              ประวัติการทดลอง
            </TabsTrigger>
          </TabsList>

          <TabsContent value="input" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>ข้อมูลการทดลอง</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="experiment_name">ชื่อการทดลอง *</Label>
                    <Input
                      id="experiment_name"
                      value={currentExperiment.experiment_name}
                      onChange={(e) => setCurrentExperiment(prev => ({
                        ...prev, experiment_name: e.target.value
                      }))}
                      placeholder="เช่น การเปรียบเทียบ qPCR vs RPA"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="description">คำอธิบายการทดลอง</Label>
                  <Textarea
                    id="description"
                    value={currentExperiment.description}
                    onChange={(e) => setCurrentExperiment(prev => ({
                      ...prev, description: e.target.value
                    }))}
                    placeholder="อธิบายรายละเอียดการทดลอง..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>ข้อมูลเทคนิคการตรวจสอบ</CardTitle>
                <Button onClick={addTechnique} className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  เพิ่มเทคนิค
                </Button>
              </CardHeader>
              <CardContent>
                {currentExperiment.techniques.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      กรุณาเพิ่มข้อมูลเทคนิคอย่างน้อย 2 เทคนิคเพื่อเปรียบเทียบ
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-6">
                    {currentExperiment.techniques.map((technique, index) => (
                      <Card key={index} className="border-l-4 border-l-blue-500">
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">เทคนิคที่ {index + 1}</Badge>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => removeTechnique(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label>ชื่อเทคนิค *</Label>
                              <Select
                                value={technique.technique_name}
                                onValueChange={(value) => updateTechnique(index, 'technique_name', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="เลือกเทคนิค" />
                                </SelectTrigger>
                                <SelectContent>
                                  {AVAILABLE_TECHNIQUES.map(tech => (
                                    <SelectItem key={tech} value={tech}>{tech}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div>
                              <Label>ระดับความเชื่อมั่น</Label>
                              <Select
                                value={technique.confidence_level.toString()}
                                onValueChange={(value) => updateTechnique(index, 'confidence_level', parseFloat(value))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0.90">90%</SelectItem>
                                  <SelectItem value="0.95">95%</SelectItem>
                                  <SelectItem value="0.99">99%</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <Separator />
                          
                          <div>
                            <h4 className="font-medium mb-3">ตาราง Confusion Matrix (2x2)</h4>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>True Positive (TP)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={technique.matrix.true_positive}
                                  onChange={(e) => updateMatrix(index, 'true_positive', e.target.value)}
                                />
                              </div>
                              <div>
                                <Label>False Positive (FP)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={technique.matrix.false_positive}
                                  onChange={(e) => updateMatrix(index, 'false_positive', e.target.value)}
                                />
                              </div>
                              <div>
                                <Label>False Negative (FN)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={technique.matrix.false_negative}
                                  onChange={(e) => updateMatrix(index, 'false_negative', e.target.value)}
                                />
                              </div>
                              <div>
                                <Label>True Negative (TN)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={technique.matrix.true_negative}
                                  onChange={(e) => updateMatrix(index, 'true_negative', e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                
                {currentExperiment.techniques.length > 0 && (
                  <div className="flex justify-center pt-6">
                    <Button
                      onClick={submitExperiment}
                      disabled={loading}
                      size="lg"
                      className="px-8"
                    >
                      {loading ? "กำลังคำนวณ..." : "คำนวณและเปรียบเทียบ"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            {!results ? (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-gray-500">ยังไม่มีผลลัพธ์ กรุณาป้อนข้อมูลและคำนวณก่อน</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>สรุปผลการทดลอง: {results.experiment_name}</CardTitle>
                    {results.description && (
                      <p className="text-gray-600">{results.description}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {results.comparison_summary.best_sensitivity}
                        </div>
                        <div className="text-sm text-gray-600">ความไวสูงสุด</div>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {results.comparison_summary.best_specificity}
                        </div>
                        <div className="text-sm text-gray-600">ความจำเพาะสูงสุด</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">
                          {results.comparison_summary.best_accuracy}
                        </div>
                        <div className="text-sm text-gray-600">ความแม่นยำสูงสุด</div>
                      </div>
                      <div className="text-center p-4 bg-orange-50 rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">
                          {results.comparison_summary.best_kappa}
                        </div>
                        <div className="text-sm text-gray-600">Cohen's Kappa สูงสุด</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>การเปรียบเทียบค่าสถิติ (%)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={prepareChartData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="sensitivity" fill="#10b981" name="Sensitivity" />
                          <Bar dataKey="specificity" fill="#3b82f6" name="Specificity" />
                          <Bar dataKey="accuracy" fill="#8b5cf6" name="Accuracy" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>การเปรียบเทียบประสิทธิภาพรวม</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <RadarChart data={prepareRadarData()}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="metric" />
                          <PolarRadiusAxis angle={90} domain={[0, 100]} />
                          {results.techniques_results.map((tech, index) => (
                            <Radar
                              key={index}
                              name={tech.technique_name}
                              dataKey={tech.technique_name}
                              stroke={`hsl(${index * 120}, 70%, 50%)`}
                              fill={`hsl(${index * 120}, 70%, 50%)`}
                              fillOpacity={0.1}
                            />
                          ))}
                          <Tooltip />
                          <Legend />
                        </RadarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>รายละเอียดผลลัพธ์แต่ละเทคนิค</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {results.techniques_results.map((result, index) => (
                        <Card key={index}>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Badge variant="outline">{result.technique_name}</Badge>
                              <span className="text-sm font-normal">{result.interpretation}</span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div>
                                <div className="font-medium">Sensitivity</div>
                                <div className="text-2xl text-green-600">
                                  {(result.stats.sensitivity * 100).toFixed(1)}%
                                </div>
                                <div className="text-xs text-gray-500">
                                  95% CI: {(result.stats.sensitivity_ci[0] * 100).toFixed(1)}% - {(result.stats.sensitivity_ci[1] * 100).toFixed(1)}%
                                </div>
                              </div>
                              
                              <div>
                                <div className="font-medium">Specificity</div>
                                <div className="text-2xl text-blue-600">
                                  {(result.stats.specificity * 100).toFixed(1)}%
                                </div>
                                <div className="text-xs text-gray-500">
                                  95% CI: {(result.stats.specificity_ci[0] * 100).toFixed(1)}% - {(result.stats.specificity_ci[1] * 100).toFixed(1)}%
                                </div>
                              </div>
                              
                              <div>
                                <div className="font-medium">PPV</div>
                                <div className="text-2xl text-purple-600">
                                  {(result.stats.ppv * 100).toFixed(1)}%
                                </div>
                                <div className="text-xs text-gray-500">
                                  95% CI: {(result.stats.ppv_ci[0] * 100).toFixed(1)}% - {(result.stats.ppv_ci[1] * 100).toFixed(1)}%
                                </div>
                              </div>
                              
                              <div>
                                <div className="font-medium">NPV</div>
                                <div className="text-2xl text-orange-600">
                                  {(result.stats.npv * 100).toFixed(1)}%
                                </div>
                                <div className="text-xs text-gray-500">
                                  95% CI: {(result.stats.npv_ci[0] * 100).toFixed(1)}% - {(result.stats.npv_ci[1] * 100).toFixed(1)}%
                                </div>
                              </div>
                            </div>
                            
                            <Separator className="my-4" />
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <div className="font-medium">Accuracy</div>
                                <div className="text-xl">{(result.stats.accuracy * 100).toFixed(1)}%</div>
                              </div>
                              <div>
                                <div className="font-medium">Cohen's Kappa</div>
                                <div className="text-xl">{result.cohen_kappa.toFixed(3)}</div>
                                <div className="text-xs text-gray-500">
                                  95% CI: {result.cohen_kappa_ci[0].toFixed(3)} - {result.cohen_kappa_ci[1].toFixed(3)}
                                </div>
                              </div>
                              <div>
                                <div className="font-medium">Prevalence</div>
                                <div className="text-xl">{(result.stats.prevalence * 100).toFixed(1)}%</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>ประวัติการทดลอง</CardTitle>
              </CardHeader>
              <CardContent>
                {experiments.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">ยังไม่มีการทดลองในระบบ</p>
                ) : (
                  <div className="space-y-4">
                    {experiments.map((exp) => (
                      <Card key={exp.id} className="cursor-pointer hover:shadow-md transition-shadow">
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-medium">{exp.experiment_name}</h3>
                              <p className="text-sm text-gray-500 mt-1">{exp.description}</p>
                              <div className="flex gap-2 mt-2">
                                {exp.techniques_results.map((tech, index) => (
                                  <Badge key={index} variant="outline">{tech.technique_name}</Badge>
                                ))}
                              </div>
                            </div>
                            <div className="text-sm text-gray-500">
                              {new Date(exp.created_at).toLocaleDateString('th-TH')}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default App;