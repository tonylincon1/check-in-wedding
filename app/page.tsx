'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { UserPlus, QrCode, Trash2, Edit, CheckCircle, User, Users, Search, UserCircle2, Users2, Crown, Home, Briefcase, Heart } from 'lucide-react'
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import jsQR from 'jsqr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

type Convidado = {
  id: string
  Nome: string
  Email: string
  Telefone: string
  Confirmacao: string
  Mensagem: string
  DataHoraConfirmacao: string
  DataHoraCheckIn: string | null
  TipoConvidado: string
}

export default function PaginaCheckIn() {
  const [convidadosPendentes, setConvidadosPendentes] = useState<Convidado[]>([])
  const [convidadosRegistrados, setConvidadosRegistrados] = useState<Convidado[]>([])
  const [todosConvidados, setTodosConvidados] = useState<Convidado[]>([])
  const [escaneando, setEscaneando] = useState(false)
  const [adicionandoConvidado, setAdicionandoConvidado] = useState(false)
  const [atualizandoConvidado, setAtualizandoConvidado] = useState(false)
  const [excluindoConvidado, setExcluindoConvidado] = useState(false)
  const [novoConvidado, setNovoConvidado] = useState<Partial<Convidado>>({})
  const [convidadoSelecionado, setConvidadoSelecionado] = useState<Convidado | null>(null)
  const [termoPesquisa, setTermoPesquisa] = useState('')
  const [paginaAtualPendentes, setPaginaAtualPendentes] = useState(1)
  const [paginaAtualRegistrados, setPaginaAtualRegistrados] = useState(1)
  const [totalPaginasPendentes, setTotalPaginasPendentes] = useState(1)
  const [totalPaginasRegistrados, setTotalPaginasRegistrados] = useState(1)
  const [totalConvidadosPendentes, setTotalConvidadosPendentes] = useState(0)
  const [totalConvidadosRegistrados, setTotalConvidadosRegistrados] = useState(0)
  const [checkInManual, setCheckInManual] = useState(false)
  const [pesquisaCheckInManual, setPesquisaCheckInManual] = useState('')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const itensPorPagina = 10
  const [filteredGuests, setFilteredGuests] = useState<Convidado[]>([])
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [guestTypeCounts, setGuestTypeCounts] = useState({
    pendentes: {} as Record<string, number>,
    registrados: {} as Record<string, number>
  })
  const [allConvidadosPendentes, setAllConvidadosPendentes] = useState<Convidado[]>([])
  const [allConvidadosRegistrados, setAllConvidadosRegistrados] = useState<Convidado[]>([])

  useEffect(() => {
    checkSession()
    buscarConvidados()
    buscarTodosConvidados()
  }, [paginaAtualPendentes, paginaAtualRegistrados, termoPesquisa, activeFilter])

  async function checkSession() {
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      console.error('Error getting session:', error)
    } else if (!data.session) {
      console.warn('No active session')
    } else {
      console.log('Active session found')
    }
  }

  async function buscarConvidados() {
    const indiceInicialPendentes = (paginaAtualPendentes - 1) * itensPorPagina
    const indiceInicialRegistrados = (paginaAtualRegistrados - 1) * itensPorPagina

    let queryPendentes = supabase
      .from('convidados')
      .select('*', { count: 'exact' })
      .is('DataHoraCheckIn', null)

    let queryRegistrados = supabase
      .from('convidados')
      .select('*', { count: 'exact' })
      .not('DataHoraCheckIn', 'is', null)

    if (termoPesquisa) {
      const searchFilter = `Nome.ilike.%${termoPesquisa}%,Email.ilike.%${termoPesquisa}%,Telefone.ilike.%${termoPesquisa}%`
      queryPendentes = queryPendentes.or(searchFilter)
      queryRegistrados = queryRegistrados.or(searchFilter)
    }

    if (activeFilter) {
      queryPendentes = queryPendentes.eq('TipoConvidado', activeFilter)
      queryRegistrados = queryRegistrados.eq('TipoConvidado', activeFilter)
    }

    const { data: allPendentesData, error: pendentesError, count: pendentesCount } = await queryPendentes
      .order('Nome', { ascending: true })

    const { data: allRegistradosData, error: registradosError, count: registradosCount } = await queryRegistrados
      .order('Nome', { ascending: true })

    if (pendentesError) {
      console.error('Erro ao buscar convidados pendentes:', pendentesError)
      setAlertMessage("Erro ao buscar convidados pendentes. Por favor, tente novamente mais tarde.")
    } else {
      setAllConvidadosPendentes(allPendentesData || [])
      setConvidadosPendentes(allPendentesData?.slice(indiceInicialPendentes, indiceInicialPendentes + itensPorPagina) || [])
      setTotalPaginasPendentes(Math.ceil((pendentesCount || 0) / itensPorPagina))
      setTotalConvidadosPendentes(pendentesCount || 0)
      updateGuestTypeCounts(allPendentesData || [], 'pendentes')
    }

    if (registradosError) {
      console.error('Erro ao buscar convidados registrados:', registradosError)
      setAlertMessage("Erro ao buscar convidados registrados. Por favor, tente novamente mais tarde.")
    } else {
      setAllConvidadosRegistrados(allRegistradosData || [])
      setConvidadosRegistrados(allRegistradosData?.slice(indiceInicialRegistrados, indiceInicialRegistrados + itensPorPagina) || [])
      setTotalPaginasRegistrados(Math.ceil((registradosCount || 0) / itensPorPagina))
      setTotalConvidadosRegistrados(registradosCount || 0)
      updateGuestTypeCounts(allRegistradosData || [], 'registrados')
    }
  }

  async function buscarTodosConvidados() {
    const { data, error } = await supabase
      .from('convidados')
      .select('*')
      .order('Nome', { ascending: true })

    if (error) {
      console.error('Erro ao buscar todos os convidados:', error)
      setAlertMessage("Erro ao buscar todos os convidados. Por favor, tente novamente mais tarde.")
    } else {
      setTodosConvidados(data || [])
    }
  }

  async function realizarCheckIn(id: string) {
    const { data, error } = await supabase
      .from('convidados')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Erro ao buscar convidado:', error)
      setAlertMessage("Ocorreu um erro ao buscar as informações do convidado. Por favor, tente novamente.")
      return
    }

    if (!data) {
      setAlertMessage("Não foi possível encontrar um convidado com o ID fornecido.")
      return
    }

    if (data.DataHoraCheckIn) {
      setAlertMessage(`O convidado ${data.Nome} (${data.TipoConvidado}) já realizou o check-in em ${new Date(data.DataHoraCheckIn).toLocaleString()}.`)
      return
    }

    const dataHoraCheckIn = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('convidados')
      .update({ DataHoraCheckIn: dataHoraCheckIn })
      .eq('id', id)

    if (updateError) {
      console.error('Erro ao atualizar check-in:', updateError)
      setAlertMessage("Ocorreu um erro ao registrar o check-in. Por favor, tente novamente.")
    } else {
      setAlertMessage(`O convidado ${data.Nome} (${data.TipoConvidado}) fez check-in com sucesso.`)
      buscarConvidados()
      buscarTodosConvidados()
    }
  }

  function processarResultadoEscaneamento(resultado: string | null) {
    setEscaneando(false)
    if (resultado) {
      realizarCheckIn(resultado)
    } else {
      setAlertMessage("Não foi possível detectar um QR Code válido. Por favor, tente novamente.")
    }
  }

  async function adicionarConvidado(registrado: boolean) {
    const dadosConvidado = {
      ...novoConvidado,
      DataHoraCheckIn: registrado ? new Date().toISOString() : null,
    }

    const { data, error } = await supabase
      .from('convidados')
      .insert([dadosConvidado])
      .select()

    if (error) {
      setAlertMessage("Erro ao adicionar convidado. Por favor, tente novamente.")
    } else if (data && data.length > 0) {
      const convidadoAdicionado = data[0]
      setAdicionandoConvidado(false)
      setNovoConvidado({})
      setAlertMessage(`${convidadoAdicionado.Nome} foi adicionado à lista de ${registrado ? 'registrados' : 'pendentes'}.`)
      buscarConvidados()
      buscarTodosConvidados()
    }
  }

  async function atualizarConvidado() {
    if (!convidadoSelecionado) return
  
    const { data, error } = await supabase
      .from('convidados')
      .upsert(convidadoSelecionado, { onConflict: 'id' })
      .select()
  
    if (error) {
      console.error('Erro ao atualizar convidado:', error)
      setAlertMessage("Erro ao atualizar convidado. Por favor, tente novamente.")
    } else if (data && data.length > 0) {
      const convidadoAtualizado = data[0]
      setAtualizandoConvidado(false)
      setConvidadoSelecionado(null)
      setAlertMessage(`As informações de ${convidadoAtualizado.Nome} foram atualizadas.`)
      buscarConvidados()
      buscarTodosConvidados()
    }
  }

  async function excluirConvidado() {
    if (!convidadoSelecionado) return

    const { error } = await supabase
      .from('convidados')
      .delete()
      .eq('id', convidadoSelecionado.id)

    if (error) {
      console.error('Erro ao excluir convidado:', error)
      setAlertMessage("Erro ao excluir convidado. Por favor, tente novamente.")
    } else {
      setExcluindoConvidado(false)
      setConvidadoSelecionado(null)
      setAlertMessage(`${convidadoSelecionado.Nome} foi removido da lista de convidados.`)
      buscarConvidados()
      buscarTodosConvidados()
    }
  }

  const updateGuestTypeCounts = (guests: Convidado[], listType: 'pendentes' | 'registrados') => {
    const counts = guests.reduce((acc, guest) => {
      acc[guest.TipoConvidado] = (acc[guest.TipoConvidado] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    setGuestTypeCounts(prev => ({ ...prev, [listType]: counts }))
  }

  const getGuestTypeColor = (tipo: string) => {
    switch (tipo) {
      case 'Amigo': return 'bg-blue-500'
      case 'Convidado Pais': return 'bg-green-500'
      case 'Padrinhos': return 'bg-purple-500'
      case 'Família': return 'bg-red-500'
      case 'Trabalho': return 'bg-yellow-500'
      case 'Cônjuge Amigo': return 'bg-pink-500'
      default: return 'bg-gray-500'
    }
  }

  const getGuestTypeIcon = (tipo: string) => {
    switch (tipo) {
      case 'Amigo': return <UserCircle2 className="h-4 w-4" />
      case 'Convidado Pais': return <Users2 className="h-4 w-4" />
      case 'Padrinhos': return <Crown className="h-4 w-4" />
      case 'Família': return <Home className="h-4 w-4" />
      case 'Trabalho': return <Briefcase className="h-4 w-4" />
      case 'Cônjuge Amigo': return <Heart className="h-4 w-4" />
      default: return <User className="h-4 w-4" />
    }
  }

  const renderGuestTypeCounts = (listType: 'pendentes' | 'registrados') => {
    const guests = listType === 'pendentes' ? allConvidadosPendentes : allConvidadosRegistrados;
    return (
      <div className="grid grid-cols-2 gap-2 mt-4">
        {Object.entries(guestTypeCounts[listType]).map(([tipo, count]) => (
          <div key={tipo} className="flex items-center space-x-2">
            <span className={`inline-block w-3 h-3 rounded-full ${getGuestTypeColor(tipo)}`}></span>
            {getGuestTypeIcon(tipo)}
            <span className="text-sm font-medium">{tipo}: {count}</span>
          </div>
        ))}
      </div>
    )
  }

  const renderizarLegenda = () => (
    <div className="flex flex-wrap justify-center gap-4 mb-4">
      {['Amigo', 'Convidado Pais', 'Padrinhos', 'Família', 'Trabalho', 'Cônjuge Amigo'].map((tipo) => (
        <Button
          key={tipo}
          variant="outline"
          size="sm"
          className={`flex items-center ${activeFilter === tipo ? 'bg-primary text-primary-foreground' : ''}`}
          onClick={() => {
            setActiveFilter(activeFilter === tipo ? null : tipo)
            setPaginaAtualPendentes(1)
            setPaginaAtualRegistrados(1)
          }}
        >
          <span className={`inline-block w-3 h-3 rounded-full mr-2 ${getGuestTypeColor(tipo)}`}></span>
          <span className="text-sm">{tipo}</span>
        </Button>
      ))}
    </div>
  )

  const renderizarTabela = (convidados: Convidado[], titulo: string, totalConvidados: number, paginaAtual: number, setPaginaAtual: (page: number) => void, totalPaginas: number) => {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{titulo} ({totalConvidados})</CardTitle>
        </CardHeader>
        <CardContent>
          {renderizarLegenda()}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    <div className="flex items-center">
                      Tipo
                      {activeFilter && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setActiveFilter(null)
                            setPaginaAtualPendentes(1)
                            setPaginaAtualRegistrados(1)
                          }}
                          className="ml-2"
                        >
                          (Limpar filtro)
                        </Button>
                      )}
                    </div>
                  </TableHead>
                  {titulo === "Convidados Registrados" && <TableHead className="hidden sm:table-cell">Data/Hora Check-in</TableHead>}
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {convidados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={titulo === "Convidados Registrados" ? 6 : 5} className="text-center">
                      Nenhum convidado encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  convidados.map((convidado) => (
                    <TableRow key={convidado.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-block w-3 h-3 rounded-full ${getGuestTypeColor(convidado.TipoConvidado)}`}></span>
                          <span>{convidado.Nome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{convidado.Email}</TableCell>
                      <TableCell className="hidden sm:table-cell">{convidado.Telefone}</TableCell>
                      <TableCell className="hidden sm:table-cell">{convidado.TipoConvidado}</TableCell>
                      {titulo === "Convidados Registrados" && (
                        <TableCell className="hidden sm:table-cell">{new Date(convidado.DataHoraCheckIn!).toLocaleString()}</TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="icon" onClick={() => {
                            setConvidadoSelecionado(convidado)
                            setAtualizandoConvidado(true)
                          }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => {
                            setConvidadoSelecionado(convidado)
                            setExcluindoConvidado(true)
                          }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious onClick={() => setPaginaAtual(Math.max(paginaAtual - 1, 1))} />
                </PaginationItem>
                {Array.from({ length: totalPaginas }, (_, i) => (
                  <PaginationItem key={i} className="hidden sm:inline-block">
                    <PaginationLink onClick={() => setPaginaAtual(i + 1)} isActive={paginaAtual === i + 1}>
                      {i + 1}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext onClick={() => setPaginaAtual(Math.min(paginaAtual + 1, totalPaginas))} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>
    )
  }

  const searchGuests = () => {
    const filtered = todosConvidados.filter(convidado =>
      (convidado.Nome?.toLowerCase() || '').includes(pesquisaCheckInManual.toLowerCase()) ||
      (convidado.Email?.toLowerCase() || '').includes(pesquisaCheckInManual.toLowerCase()) ||
      (convidado.Telefone?.toLowerCase() || '').includes(pesquisaCheckInManual.toLowerCase())
    )
    setFilteredGuests(filtered)
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      console.error("Error accessing camera:", err)
      setAlertMessage("Erro ao acessar a câmera. Por favor, verifique as permissões da câmera e tente novamente.")
    }
  }

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach(track => track.stop())
    }
  }

  useEffect(() => {
    if (escaneando) {
      startCamera()
    } else {
      stopCamera()
    }
  }, [escaneando])

  const captureImage = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas')
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
      const imageSrc = canvas.toDataURL('image/jpeg')
      setCapturedImage(imageSrc)
      processQRCode(canvas)
    }
  }

  const processQRCode = (canvas: HTMLCanvasElement) => {
    const imageData = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height)
    if (imageData) {
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code) {
        console.log("QR Code scanned:", code.data)
        processarResultadoEscaneamento(code.data)
      } else {
        processarResultadoEscaneamento(null)
      }
    }
  }

  return (
    <div className="container mx-auto p-4 space-y-8">
      <header className="text-center mb-16 mt-16">
        <h1 className="text-4xl font-bold text-primary mb-2">Check-in Casamento Thaís & Antônio</h1>
        <p className="text-xl text-muted-foreground">Gerenciamento dos convidados</p>
      </header>

      <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-8">
        <Button 
          onClick={() => setEscaneando(true)} 
          className="bg-black text-white w-full sm:w-auto hover:bg-gray-800 transition-colors"
        >
          <QrCode className="mr-2 h-4 w-4" /> Check-in Automático
        </Button>
        <Button onClick={() => setCheckInManual(true)} className="bg-secondary text-secondary-foreground w-full sm:w-auto">
          <CheckCircle className="mr-2 h-4 w-4" /> Check-in Manual
        </Button>
        <Button onClick={() => setAdicionandoConvidado(true)} className="bg-secondary text-secondary-foreground w-full sm:w-auto">
          <UserPlus className="mr-2 h-4 w-4" /> Adicionar Convidado
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-center">
              <User className="mr-2" />
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-center mb-4">{allConvidadosPendentes.length}</div>
            <ScrollArea className="h-40">
              {renderGuestTypeCounts('pendentes')}
            </ScrollArea>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-center">
              <Users className="mr-2" />
              Check-ins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-center mb-4">{allConvidadosRegistrados.length}</div>
            <ScrollArea className="h-40">
              {renderGuestTypeCounts('registrados')}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4">
        <Input
          type="text"
          placeholder="Pesquisar convidados..."
          value={termoPesquisa}
          onChange={(e) => setTermoPesquisa(e.target.value)}
          className="w-full h-12 text-lg"
        />
      </div>

      <Tabs defaultValue="pendentes" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
          <TabsTrigger value="registrados">Check-ins</TabsTrigger>
        </TabsList>
        <TabsContent value="pendentes">
          {renderizarTabela(convidadosPendentes, "Pendentes", totalConvidadosPendentes, paginaAtualPendentes, setPaginaAtualPendentes, totalPaginasPendentes)}
        </TabsContent>
        <TabsContent value="registrados">
          {renderizarTabela(convidadosRegistrados, "Check-ins", totalConvidadosRegistrados, paginaAtualRegistrados, setPaginaAtualRegistrados, totalPaginasRegistrados)}
        </TabsContent>
      </Tabs>

      <Dialog open={!!alertMessage} onOpenChange={() => setAlertMessage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notificação</DialogTitle>
          </DialogHeader>
          <DialogDescription>{alertMessage}</DialogDescription>
          <DialogFooter>
            <Button onClick={() => setAlertMessage(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adicionandoConvidado} onOpenChange={setAdicionandoConvidado}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Novo Convidado</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="nome" className="text-right">
                Nome
              </Label>
              <Input
                id="nome"
                value={novoConvidado.Nome || ''}
                onChange={(e) => setNovoConvidado({ ...novoConvidado, Nome: e.target.value })}
                className="col-span-3 h-12 text-lg w-50"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                value={novoConvidado.Email || ''}
                onChange={(e) => setNovoConvidado({ ...novoConvidado, Email: e.target.value })}
                className="col-span-3 h-12 text-lg w-50"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="telefone" className="text-right">
                Telefone
              </Label>
              <Input
                id="telefone"
                value={novoConvidado.Telefone || ''}
                onChange={(e) => setNovoConvidado({ ...novoConvidado, Telefone: e.target.value })}
                className="col-span-3 h-12 text-lg w-50"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="tipoConvidado" className="text-right">
                Tipo de Convidado
              </Label>
              <Input
                id="tipoConvidado"
                value={novoConvidado.TipoConvidado || ''}
                onChange={(e) => setNovoConvidado({ ...novoConvidado, TipoConvidado: e.target.value })}
                className="col-span-3 h-12 text-lg w-50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => adicionarConvidado(false)}>Pendentes</Button>
            <Button onClick={() => adicionarConvidado(true)}>Check-ins</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={atualizandoConvidado} onOpenChange={setAtualizandoConvidado}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar Convidado</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="atualizarNome" className="text-right">
                Nome
              </Label>
              <Input
                id="atualizarNome"
                value={convidadoSelecionado?.Nome || ''}
                onChange={(e) => setConvidadoSelecionado(prev => prev ? { ...prev, Nome: e.target.value } : null)}
                className="col-span-3 h-12 text-lg w-50"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="atualizarEmail" className="text-right">
                Email
              </Label>
              <Input
                id="atualizarEmail"
                value={convidadoSelecionado?.Email || ''}
                onChange={(e) => setConvidadoSelecionado(prev => prev ? { ...prev, Email: e.target.value } : null)}
                className="col-span-3 h-12 text-lg w-50"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="atualizarTelefone" className="text-right">
                Telefone
              </Label>
              <Input
                id="atualizarTelefone"
                value={convidadoSelecionado?.Telefone || ''}
                onChange={(e) => setConvidadoSelecionado(prev => prev ? { ...prev, Telefone: e.target.value } : null)}
                className="col-span-3 h-12 text-lg w-40"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="atualizarTipoConvidado" className="text-right">
                Tipo de Convidado
              </Label>
              <Input
                id="atualizarTipoConvidado"
                value={convidadoSelecionado?.TipoConvidado || ''}
                onChange={(e) => setConvidadoSelecionado(prev => prev ? { ...prev, TipoConvidado: e.target.value } : null)}
                className="col-span-3 h-12 text-lg w-50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={atualizarConvidado}>Atualizar Convidado</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={excluindoConvidado} onOpenChange={setExcluindoConvidado}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Convidado</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir {convidadoSelecionado?.Nome}? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluindoConvidado(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={excluirConvidado}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={escaneando} onOpenChange={setEscaneando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escanear Código QR</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center">
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', maxWidth: '400px' }} />
            <Button onClick={captureImage} className="mt-4">Capturar e Processar QR Code</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={checkInManual} onOpenChange={setCheckInManual}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Check-in Manual</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="pesquisaConvidado" className="text-right">
                Buscar
              </Label>
              <Input
                id="pesquisaConvidado"
                value={pesquisaCheckInManual}
                onChange={(e) => setPesquisaCheckInManual(e.target.value)}
                placeholder="Nome, email ou telefone"
                className="col-span-3 h-12 text-lg w-50"
              />
            </div>
            <Button onClick={searchGuests}>
              Buscar Convidados
            </Button>
          </div>
          <ScrollArea className="h-[200px] w-full rounded-md border p-4">
            {filteredGuests.map((convidado) => (
              <div key={convidado.id} className="flex items-center justify-between py-2">
                <span>{convidado.Nome}</span>
                <Button
                  onClick={() => {
                    realizarCheckIn(convidado.id)
                    setCheckInManual(false)
                    setPesquisaCheckInManual('')
                  }}
                  disabled={convidado.DataHoraCheckIn !== null}
                >
                  {convidado.DataHoraCheckIn ? 'Já registrado' : 'Check-in'}
                </Button>
              </div>
            ))}
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => {
              setCheckInManual(false)
              setPesquisaCheckInManual('')
            }}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}